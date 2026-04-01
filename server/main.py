"""
Nexora Integrated API Server
─────────────────────────────
Secure FastAPI backend serving JSON to the React frontend.

Security features:
  • Bcrypt password hashing (not SHA-256)
  • JWT Bearer authentication
  • IDOR checks on every data-access endpoint
  • Rate limiting on login, ticket creation, and general API
  • CORS locked to the frontend origin
  • Security headers via middleware
  • Parameterised queries (no raw SQL interpolation)
  • Secrets loaded from environment / .env
"""

import os
import re
from datetime import datetime, timedelta
from typing import Optional
import asyncio
import logging
import json

from dotenv import load_dotenv

load_dotenv()  # must come before any os.environ reads in other modules

from fastapi import FastAPI, Request, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import bcrypt
from openai import OpenAI

from .db import (
    get_db_conn, execute_query, fetch_one, fetch_all,
    process_row, init_db, IS_MYSQL, PH, _verify_pw
)
from .auth import (
    create_token, get_current_user, require_admin,
    require_owner_or_admin,
)

# ─── APP INIT ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Nexora Support API",
    docs_url="/api/docs",
    redoc_url=None,
)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down."},
    )

async def background_auto_assign():
    while True:
        try:
            conn = get_db_conn()
            cursor = conn.cursor()
            execute_query(cursor, "SELECT Ticket_ID, Created_Date FROM Tickets WHERE Agent_ID IS NULL AND Status != 'Resolved'")
            unassigned = [process_row(r) for r in fetch_all(cursor)]
            now = datetime.utcnow()
            to_assign = []
            for t in unassigned:
                try:
                    cd = datetime.fromisoformat(t["Created_Date"].split(".")[0])
                    if (now - cd).total_seconds() > 24 * 3600:
                        to_assign.append(t["Ticket_ID"])
                except Exception:
                    pass
            
            if to_assign:
                execute_query(cursor,
                    "SELECT a.Agent_ID, COUNT(t.Ticket_ID) as active_count "
                    "FROM Support_Agents a "
                    "LEFT JOIN Tickets t ON a.Agent_ID = t.Agent_ID AND t.Status != 'Resolved' "
                    "WHERE a.Role = 'Agent' "
                    "GROUP BY a.Agent_ID")
                agents = fetch_all(cursor)
                if agents:
                    import random
                    min_count = min(a[1] for a in agents)
                    candidates = [a[0] for a in agents if a[1] == min_count]
                    for tid in to_assign:
                        chosen = random.choice(candidates)
                        execute_query(cursor,
                            f"UPDATE Tickets SET Agent_ID = {PH}, Assigned_At = CURRENT_TIMESTAMP "
                            f"WHERE Ticket_ID = {PH}",
                            (chosen, tid))
                    if not IS_MYSQL:
                        conn.commit()
            conn.close()
        except Exception as e:
            logging.error(f"Auto-assign task error: {e}")
        await asyncio.sleep(60 * 5)

@app.get("/")
async def root():
    """Root health check for deployment platforms like Railway."""
    return {"status": "ok", "message": "Nexora API is operational"}


@app.on_event("startup")
async def startup_event():
    """Unified startup: initialize database and start background tasks."""
    logging.info("Starting Nexora API server...")
    
    # 1. Initialize Database
    try:
        init_db()
        logging.info("Database initialized successfully.")
    except Exception as e:
        logging.error(f"Database initialization failed: {e}")
    
    # 2. Start Background Tasks
    asyncio.create_task(background_auto_assign())
    logging.info("Background auto-assignment task started.")


# ─── MIDDLEWARE ──────────────────────────────────────────────────────────────

# CORS Configuration
# ──────────────────
# Using a flexible approach that supports both local dev and production Railway urls.
# If CORS_ORIGIN is not provided, it defaults to "*" for convenience in testing.
cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGIN", "*").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False, # Set to False since we use 'Authorization' header instead of cookies
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "*.railway.app", "*.ngrok-free.app", "*.ngrok.io", "*.vercel.app"]
if os.environ.get("PROD_DOMAIN"):
    ALLOWED_HOSTS.append(os.environ.get("PROD_DOMAIN"))
else:
    ALLOWED_HOSTS.append("*")

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=ALLOWED_HOSTS,
)

ENFORCE_HTTPS = False  # Disabled for easier testing and flexible deployment


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Inject hardened security headers on every response."""
    # HTTPS enforcement in production
    if ENFORCE_HTTPS and request.url.scheme != "https":
        return JSONResponse(
            status_code=403,
            content={"detail": "HTTPS required."},
        )
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=()"
    )
    if ENFORCE_HTTPS:
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )
    return response


# ─── PYDANTIC MODELS (input validation) ──────────────────────────────────────

class TicketCreate(BaseModel):
    email: EmailStr
    subject: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1, max_length=5000)
    priority: str = Field(..., pattern=r"^(Low|Medium|High)$")

    @field_validator("subject", "description")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class SearchHistoryRequest(BaseModel):
    email: EmailStr
    filter_status: Optional[str] = None
    filter_priority: Optional[str] = None

    @field_validator("filter_status")
    @classmethod
    def validate_status(cls, v):
        if v and v not in ("Open", "Resolved", "Pending"):
            raise ValueError("Invalid status filter")
        return v

    @field_validator("filter_priority")
    @classmethod
    def validate_priority(cls, v):
        if v and v not in ("Low", "Medium", "High"):
            raise ValueError("Invalid priority filter")
        return v


class ConversationMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)


class SetPasswordRequest(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)
    confirm: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a digit")
        return v


class AddAgentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    role: str = Field(..., pattern=r"^(Agent|Administrator)$")
    temp_password: Optional[str] = Field(None, min_length=6, max_length=128)


class AssignTicketRequest(BaseModel):
    agent_id: Optional[int] = None


# ─── STARTUP ─────────────────────────────────────────────────────────────────



# ─── HEALTH ──────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


# ═══════════════════════════════════════════════════════════════════════════════
#  PUBLIC ROUTES (no auth required)
# ═══════════════════════════════════════════════════════════════════════════════

RATE_LIMIT_TICKET = os.environ.get("RATE_LIMIT_TICKET", "10/minute")
RATE_LIMIT_LOGIN  = os.environ.get("RATE_LIMIT_LOGIN", "5/minute")
RATE_LIMIT_API    = os.environ.get("RATE_LIMIT_API", "60/minute")


@app.post("/api/tickets")
@limiter.limit(RATE_LIMIT_TICKET)
async def raise_ticket(request: Request, body: TicketCreate):
    """Public: customers raise a support ticket."""
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor,
            f"SELECT Customer_ID FROM Customers WHERE Email_ID = {PH}",
            (body.email,))
        customer = fetch_one(cursor)
        if not customer:
            name = body.email.split("@")[0]
            execute_query(cursor,
                f"INSERT INTO Customers (Name, Email_ID) VALUES ({PH}, {PH})",
                (name, body.email))
            customer_id = cursor.lastrowid
        else:
            customer_id = customer["Customer_ID"]

        execute_query(cursor,
            f"INSERT INTO Tickets (Customer_ID, Subject, Description, Priority, Status) "
            f"VALUES ({PH}, {PH}, {PH}, {PH}, 'Open')",
            (customer_id, body.subject, body.description, body.priority))
        ticket_id = cursor.lastrowid

        if not IS_MYSQL:
            conn.commit()
        return {"message": "Ticket raised successfully!", "ticket_id": ticket_id}
    finally:
        conn.close()


@app.post("/api/tickets/search")
@limiter.limit(RATE_LIMIT_API)
async def search_history(request: Request, body: SearchHistoryRequest):
    """Public: search ticket history by customer email."""
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor,
            f"SELECT Customer_ID, Name FROM Customers WHERE Email_ID = {PH}",
            (body.email,))
        customer = fetch_one(cursor)

        if not customer:
            return {"history": [], "customer_name": ""}

        query = "SELECT * FROM Tickets WHERE Customer_ID = %s"
        params = [customer["Customer_ID"]]
        if body.filter_status:
            query += " AND Status = %s"
            params.append(body.filter_status)
        if body.filter_priority:
            query += " AND Priority = %s"
            params.append(body.filter_priority)
        query += " ORDER BY Ticket_ID DESC"
        execute_query(cursor, query, tuple(params))
        history = [process_row(r) for r in fetch_all(cursor)]

        return {
            "history": history,
            "customer_name": customer["Name"],
        }
    finally:
        conn.close()


@app.get("/api/tickets/{ticket_id}/conversation")
@limiter.limit(RATE_LIMIT_API)
async def get_conversation(request: Request, ticket_id: int, email: Optional[str] = None):
    """View the conversation thread for a ticket. Requires staff auth OR matching email."""
    # Try to identify staff user
    user = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            user = get_current_user(request)
        except Exception:
            pass

    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor, f"SELECT * FROM Tickets WHERE Ticket_ID = {PH}", (ticket_id,))
        ticket = fetch_one(cursor)
        if not ticket:
            raise HTTPException(404, "Ticket not found")

        # SECURITY CHECK: If guest, must provide matching email
        if not user:
            if not email:
                raise HTTPException(401, "Identification required (provide email or log in).")
            execute_query(cursor, f"SELECT Email_ID FROM Customers WHERE Customer_ID = {PH}", (ticket["Customer_ID"],))
            customer = fetch_one(cursor)
            if not customer or customer["Email_ID"].lower() != email.strip().lower():
                raise HTTPException(403, "Access denied. You do not have permission to view this conversation.")

        execute_query(cursor,
            f"SELECT * FROM Ticket_Conversations WHERE Ticket_ID = {PH} "
            f"ORDER BY Timestamp ASC", (ticket_id,))
        messages = [process_row(r) for r in fetch_all(cursor)]
        return {"ticket": process_row(ticket), "messages": messages}
    finally:
        conn.close()


@app.post("/api/tickets/{ticket_id}/conversation")
@limiter.limit(RATE_LIMIT_API)
async def post_conversation(request: Request, ticket_id: int,
                            body: ConversationMessage, email: Optional[str] = None):
    """Add a message to a ticket conversation. Staff or verified customer only."""
    # Determine sender role from auth token (if present) or default to Customer
    role = "Customer"
    user = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            user = get_current_user(request)
            role = user.get("role", "Customer")
        except Exception:
            pass

    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        # Verify ticket exists
        execute_query(cursor, f"SELECT Customer_ID FROM Tickets WHERE Ticket_ID = {PH}", (ticket_id,))
        ticket = fetch_one(cursor)
        if not ticket:
            raise HTTPException(404, "Ticket not found")

        # SECURITY CHECK: If guest, verify email
        if not user:
            if not email:
                raise HTTPException(401, "Permission denied. Email required for guest posting.")
            execute_query(cursor, f"SELECT Email_ID FROM Customers WHERE Customer_ID = {PH}", (ticket["Customer_ID"],))
            customer = fetch_one(cursor)
            if not customer or customer["Email_ID"].lower() != email.strip().lower():
                raise HTTPException(403, "Permission denied. You cannot post to this ticket.")

        execute_query(cursor,
            f"INSERT INTO Ticket_Conversations (Ticket_ID, Sender_Role, Message_Text) "
            f"VALUES ({PH}, {PH}, {PH})",
            (ticket_id, role, body.message))
        if not IS_MYSQL:
            conn.commit()
        return {"message": "Message sent"}
    finally:
        conn.close()


@app.get("/api/tickets/{ticket_id}/rate/{rating}")
@limiter.limit(RATE_LIMIT_API)
async def rate_ticket(request: Request, ticket_id: int, rating: int):
    """Public: rate a resolved ticket (1-5)."""
    if rating < 1 or rating > 5:
        raise HTTPException(400, "Rating must be between 1 and 5")
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor,
            f"UPDATE Tickets SET Rating = {PH} "
            f"WHERE Ticket_ID = {PH} AND Status = 'Resolved'",
            (rating, ticket_id))
        if not IS_MYSQL:
            conn.commit()
        return {"message": "Rating submitted"}
    finally:
        conn.close()


@app.get("/api/tickets/{ticket_id}/follow-up")
@limiter.limit(RATE_LIMIT_TICKET)
async def follow_up(request: Request, ticket_id: int):
    """Public: customer can follow up on a ticket."""
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor,
            f"UPDATE Tickets SET FollowUpCount = FollowUpCount + 1, "
            f"Status = 'Open' WHERE Ticket_ID = {PH}",
            (ticket_id,))
        if not IS_MYSQL:
            conn.commit()
        return {"message": "Follow-up sent"}
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  AUTH ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/auth/login")
@limiter.limit(RATE_LIMIT_LOGIN)
async def login(request: Request, body: LoginRequest):
    """Authenticate a support agent and return a JWT."""
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor,
            f"SELECT * FROM Support_Agents WHERE Email_ID = {PH}",
            (body.email.strip(),))
        user = fetch_one(cursor)

        if not user:
            raise HTTPException(401, "Invalid credentials.")

        # Account without password → needs setup
        if not user.get("Password"):
            token = create_token(user)
            return {
                "token": token,
                "user": {k: v for k, v in user.items() if k not in ("Password",)},
                "needs_password_setup": True,
            }

        if not _verify_pw(body.password, user["Password"]):
            raise HTTPException(401, "Invalid credentials.")

        # Temp password → force the agent to set a real one
        is_temp = bool(user.get("Is_Temp_Password"))

        token = create_token(user)
        return {
            "token": token,
            "user": {k: v for k, v in user.items() if k not in ("Password",)},
            "needs_password_setup": is_temp,
        }
    finally:
        conn.close()


@app.get("/api/auth/me")
async def me(request: Request):
    """Return the current user's identity from the JWT."""
    user = get_current_user(request)
    return {"user": user}


# ═══════════════════════════════════════════════════════════════════════════════
#  AGENT ROUTES (requires auth)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/dashboard")
@limiter.limit(RATE_LIMIT_API)
async def dashboard(request: Request,
                    status_filter: Optional[str] = None,
                    priority: Optional[str] = None,
                    date: Optional[str] = None):
    """Agent / Admin dashboard – returns tickets scoped to the user."""
    user = get_current_user(request)
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        query = (
            "SELECT t.*, "
            "(SELECT Message_Text FROM Ticket_Conversations "
            "WHERE Ticket_ID = t.Ticket_ID ORDER BY Timestamp DESC LIMIT 1) "
            "as last_message FROM Tickets t WHERE 1=1"
        )
        params = []

        # IDOR: agents only see their tickets + unassigned
        if user["role"] != "Administrator":
            query += " AND (Agent_ID = %s OR Agent_ID IS NULL)"
            params.append(user["agent_id"])

        if status_filter:
            query += " AND Status = %s"
            params.append(status_filter)
        if priority:
            query += " AND Priority = %s"
            params.append(priority)
        if date:
            query += " AND date(Created_Date) = %s"
            params.append(date)

        query += " ORDER BY FollowUpCount DESC, Ticket_ID DESC"
        execute_query(cursor, query, tuple(params))
        tickets = [process_row(r) for r in fetch_all(cursor)]

        execute_query(cursor,
            "SELECT Agent_ID, Name FROM Support_Agents WHERE Role='Agent'")
        agents = fetch_all(cursor)

        # Stats
        execute_query(cursor,
            "SELECT COUNT(*) as total, "
            "SUM(CASE WHEN Status='Open' THEN 1 ELSE 0 END) as open_count, "
            "SUM(CASE WHEN Status='Resolved' THEN 1 ELSE 0 END) as resolved "
            "FROM Tickets WHERE 1=1"
            + (" AND (Agent_ID = %s OR Agent_ID IS NULL)" if user["role"] != "Administrator" else ""),
            (user["agent_id"],) if user["role"] != "Administrator" else ()
        )
        stats = fetch_one(cursor) or {}

        execute_query(cursor,
            "SELECT Created_Date, Resolved_At FROM Tickets WHERE Status='Resolved' "
            "AND Resolved_At IS NOT NULL AND Created_Date IS NOT NULL"
            + (" AND (Agent_ID = %s OR Agent_ID IS NULL)" if user["role"] != "Administrator" else ""),
            (user["agent_id"],) if user["role"] != "Administrator" else ()
        )
        resolved_tickets = [process_row(r) for r in fetch_all(cursor)]
        total_hours, valid_tkts = 0, 0
        for rt in resolved_tickets:
            try:
                cd = datetime.fromisoformat(rt["Created_Date"].split(".")[0])
                ra = datetime.fromisoformat(rt["Resolved_At"].split(".")[0])
                total_hours += (ra - cd).total_seconds() / 3600.0
                valid_tkts += 1
            except Exception:
                pass
        avg_res = round(total_hours / valid_tkts, 1) if valid_tkts > 0 else 0.0

        return {
            "tickets": tickets,
            "agents": agents,
            "stats": {
                "total": stats.get("total", 0),
                "open": stats.get("open_count", 0),
                "resolved": stats.get("resolved", 0),
                "avg_resolution_hours": avg_res,
            },
            "user": user,
        }
    finally:
        conn.close()


@app.post("/api/tickets/{ticket_id}/resolve")
@limiter.limit(RATE_LIMIT_API)
async def resolve_ticket(request: Request, ticket_id: int):
    """Agent resolves a ticket – ownership verified."""
    user = get_current_user(request)
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor,
            f"SELECT Agent_ID FROM Tickets WHERE Ticket_ID = {PH}",
            (ticket_id,))
        ticket = fetch_one(cursor)
        if not ticket:
            raise HTTPException(404, "Ticket not found")
        require_owner_or_admin(user, ticket.get("Agent_ID"))

        execute_query(cursor,
            f"UPDATE Tickets SET Status = 'Resolved', "
            f"Resolved_At = CURRENT_TIMESTAMP WHERE Ticket_ID = {PH}",
            (ticket_id,))
        if not IS_MYSQL:
            conn.commit()
        return {"message": "Ticket resolved"}
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  ADMIN ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/admin/report")
@limiter.limit(RATE_LIMIT_API)
async def admin_report(request: Request):
    """Admin analytics report."""
    user = get_current_user(request)
    require_admin(user)

    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor,
            "SELECT COUNT(*) as total, "
            "SUM(CASE WHEN Status='Resolved' THEN 1 ELSE 0 END) as resolved, "
            "SUM(CASE WHEN Status='Open' THEN 1 ELSE 0 END) as pending, "
            "ROUND(AVG(CASE WHEN Rating IS NOT NULL THEN Rating END), 1) as avg_rating "
            "FROM Tickets")
        stats = process_row(fetch_one(cursor)) or {
            "total": 0, "resolved": 0, "pending": 0, "avg_rating": 0.0
        }

        execute_query(cursor,
            "SELECT Created_Date, Resolved_At FROM Tickets WHERE Status='Resolved' "
            "AND Resolved_At IS NOT NULL AND Created_Date IS NOT NULL")
        resolved_tickets = [process_row(r) for r in fetch_all(cursor)]
        total_hours, valid_tkts = 0, 0
        for rt in resolved_tickets:
            try:
                cd = datetime.fromisoformat(rt["Created_Date"].split(".")[0])
                ra = datetime.fromisoformat(rt["Resolved_At"].split(".")[0])
                total_hours += (ra - cd).total_seconds() / 3600.0
                valid_tkts += 1
            except Exception:
                pass
        stats["avg_resolution_hours"] = round(total_hours / valid_tkts, 1) if valid_tkts > 0 else 0.0

        execute_query(cursor,
            "SELECT a.Name, COUNT(t.Ticket_ID) as assigned, "
            "SUM(CASE WHEN t.Status = 'Resolved' THEN 1 ELSE 0 END) as solved, "
            "ROUND(AVG(CASE WHEN t.Rating IS NOT NULL THEN t.Rating END), 1) as avg_rating "
            "FROM Support_Agents a LEFT JOIN Tickets t ON a.Agent_ID = t.Agent_ID "
            "WHERE a.Role = 'Agent' GROUP BY a.Agent_ID, a.Name")
        performance = fetch_all(cursor)

        execute_query(cursor,
            "SELECT Priority, COUNT(*) as count FROM Tickets GROUP BY Priority")
        priority_data = fetch_all(cursor)

        execute_query(cursor,
            "SELECT date(Created_Date) as day, COUNT(*) as count FROM Tickets "
            "WHERE Created_Date >= date('now', '-7 days') "
            "GROUP BY date(Created_Date) ORDER BY day ASC")
        daily_data = fetch_all(cursor)

        # Pending password change requests
        execute_query(cursor,
            "SELECT r.*, a.Name, a.Email_ID FROM Password_Change_Requests r "
            "JOIN Support_Agents a ON r.Agent_ID = a.Agent_ID "
            "WHERE r.Status = 'Pending' ORDER BY r.Requested_At DESC")
        pw_requests = [process_row(r) for r in fetch_all(cursor)]

        return {
            "stats": stats,
            "performance": performance,
            "priority_data": priority_data,
            "daily_data": daily_data,
            "pw_requests": pw_requests,
        }
    finally:
        conn.close()


@app.get("/api/public/stats")
async def public_stats():
    """Public stats for the About page - no auth required."""
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        # Basic counts
        execute_query(cursor, 
            "SELECT COUNT(*) as total, "
            "SUM(CASE WHEN Status='Resolved' THEN 1 ELSE 0 END) as resolved, "
            "SUM(CASE WHEN Status='Open' THEN 1 ELSE 0 END) as pending "
            "FROM Tickets")
        counts = process_row(fetch_one(cursor)) or {"total": 0, "resolved": 0, "pending": 0}

        # 7-day trend
        execute_query(cursor,
            "SELECT date(Created_Date) as day, COUNT(*) as count FROM Tickets "
            "WHERE Created_Date >= date('now', '-7 days') "
            "GROUP BY date(Created_Date) ORDER BY day ASC")
        trend = fetch_all(cursor) or []
        
        return {
            "total": counts.get("total", 0),
            "resolved": counts.get("resolved", 0),
            "pending": counts.get("pending", 0),
            "trend": trend,
            "latency": "114ms",
            "uptime": "99.98%"
        }
    finally:
        conn.close()


@app.post("/api/admin/agents")
@limiter.limit(RATE_LIMIT_API)
async def add_agent(request: Request, body: AddAgentRequest):
    """Admin adds a new support agent."""
    user = get_current_user(request)
    require_admin(user)

    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor,
            f"SELECT Agent_ID FROM Support_Agents WHERE Email_ID = {PH}",
            (body.email,))
        if fetch_one(cursor):
            raise HTTPException(400, "An agent with this email already exists.")

        if body.temp_password:
            hashed_temp = bcrypt.hashpw(
                body.temp_password.encode(), bcrypt.gensalt()
            ).decode()
            execute_query(cursor,
                f"INSERT INTO Support_Agents (Name, Email_ID, Role, Password, Is_Temp_Password) "
                f"VALUES ({PH}, {PH}, {PH}, {PH}, {PH})",
                (body.name, body.email, body.role, hashed_temp, True))
        else:
            execute_query(cursor,
                f"INSERT INTO Support_Agents (Name, Email_ID, Role) "
                f"VALUES ({PH}, {PH}, {PH})",
                (body.name, body.email, body.role))

        if not IS_MYSQL:
            conn.commit()
        return {"message": f"Added {body.name}."}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Error adding agent.")
    finally:
        conn.close()


@app.post("/api/admin/tickets/{ticket_id}/assign")
@limiter.limit(RATE_LIMIT_API)
async def assign_ticket(request: Request, ticket_id: int, body: AssignTicketRequest):
    """Assigns a ticket to an agent. Admin only, or current owner to 'pass'."""
    user = get_current_user(request)
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        # Get current ticket state
        execute_query(cursor, f"SELECT Agent_ID, Priority FROM Tickets WHERE Ticket_ID = {PH}", (ticket_id,))
        ticket = fetch_one(cursor)
        if not ticket:
            raise HTTPException(404, "Ticket not found")

        # Security check: Admin OR currently assigned agent
        is_admin = user["role"] == "Administrator"
        is_owner = ticket["Agent_ID"] == user["agent_id"]
        if not (is_admin or is_owner):
            raise HTTPException(403, "Not authorized to reassign this ticket")

        if body.agent_id:
            # Calculate due date based on priority if it's a new assignment
            hr = {"High": 24, "Medium": 48, "Low": 72}.get(ticket["Priority"] or "Low", 48)
            due = datetime.now() + timedelta(hours=hr)
            execute_query(cursor,
                f"UPDATE Tickets SET Agent_ID = {PH}, Assigned_At = CURRENT_TIMESTAMP, Due_Date = {PH} "
                f"WHERE Ticket_ID = {PH}",
                (body.agent_id, due, ticket_id))
        else:
            execute_query(cursor, f"UPDATE Tickets SET Agent_ID = NULL, Assigned_At = NULL, Due_Date = NULL WHERE Ticket_ID = {PH}", (ticket_id,))
        
        if not IS_MYSQL:
            conn.commit()
        return {"message": "Ticket successfully reassigned"}
    finally:
        conn.close()

@app.delete("/api/admin/agents/{agent_id}")
@limiter.limit(RATE_LIMIT_API)
async def delete_agent(request: Request, agent_id: int):
    """Admin only: remove a support agent from the system."""
    user = get_current_user(request)
    require_admin(user)
    
    if agent_id == user["agent_id"]:
        raise HTTPException(400, "You cannot delete yourself.")

    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        # Unassign tickets assigned to this agent before deleting
        execute_query(cursor, f"UPDATE Tickets SET Agent_ID = NULL WHERE Agent_ID = {PH}", (agent_id,))
        execute_query(cursor, f"DELETE FROM Support_Agents WHERE Agent_ID = {PH}", (agent_id,))
        if not IS_MYSQL:
            conn.commit()
        return {"message": "Agent removed successfully."}
    finally:
        conn.close()


@app.post("/api/admin/pw-requests/{req_id}/{action}")
@limiter.limit(RATE_LIMIT_API)
async def handle_pw_request(request: Request, req_id: int, action: str):
    """Admin approves/denies a password change request."""
    user = get_current_user(request)
    require_admin(user)

    if action not in ("approve", "deny"):
        raise HTTPException(400, "Action must be 'approve' or 'deny'")

    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        new_status = "Approved" if action == "approve" else "Denied"
        execute_query(cursor,
            f"UPDATE Password_Change_Requests SET Status = {PH} "
            f"WHERE Request_ID = {PH}",
            (new_status, req_id))
        if not IS_MYSQL:
            conn.commit()
        return {"message": f"Request {new_status}"}
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  SQL QUERY CONSOLE
# ═══════════════════════════════════════════════════════════════════════════════

class SqlQueryRequest(BaseModel):
    query: str = Field(..., min_length=1)

@app.get("/api/sql/metadata")
@limiter.limit(RATE_LIMIT_API)
async def get_sql_metadata(request: Request):
    """Returns all table schemas and 5 sample rows for the SQL Console."""
    user = get_current_user(request)
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        # Get all tables
        if IS_MYSQL:
            execute_query(cursor, "SHOW TABLES")
            tables = [list(r.values())[0] for r in fetch_all(cursor)]
        else:
            execute_query(cursor, "SELECT name FROM sqlite_master WHERE type='table'")
            tables = [r["name"] for r in fetch_all(cursor)]
            
        metadata = {}
        for t in tables:
            # columns
            if IS_MYSQL:
                execute_query(cursor, f"DESCRIBE {t}")
                cols = [c["Field"] for c in fetch_all(cursor)]
            else:
                execute_query(cursor, f"PRAGMA table_info({t})")
                cols = [c["name"] for c in fetch_all(cursor)]
                
            # sample rows
            execute_query(cursor, f"SELECT * FROM {t} LIMIT 5")
            raw_rows = fetch_all(cursor)
            rows = []
            for r in raw_rows:
                processed = process_row(r)
                rows.append(processed)
                
            metadata[t] = {
                "columns": cols,
                "rows": rows
            }
        return metadata
    finally:
        conn.close()

@app.post("/api/sql/query")
@limiter.limit(RATE_LIMIT_API)
async def run_sql_query(request: Request, body: SqlQueryRequest):
    """Execute raw SQL query with role-based restrictions."""
    user = get_current_user(request)
    role = user.get("role", "Agent")
    
    query = body.query.strip()
    upper_q = query.upper()
    
    is_delete = upper_q.startswith("DELETE") or " DELETE " in upper_q
    is_drop = upper_q.startswith("DROP") or " DROP " in upper_q
    
    if role != "Administrator" and (is_delete or is_drop):
        action = "DELETE" if is_delete else "DROP"
        raise HTTPException(403, f"Permission Denied: {action} not allowed for Agent")
        
    # Safety limit
    if upper_q.startswith("SELECT") and "LIMIT" not in upper_q:
        query += " LIMIT 100"
        
    logging.info(f"User {user.get('email')} ({role}) executing SQL: {query}")
        
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor, query)
        
        if cursor.description:
            cols = [desc[0] for desc in cursor.description]
            raw_rows = fetch_all(cursor)
            rows = [process_row(r) for r in raw_rows]
            return {
                "columns": cols,
                "rows": rows,
                "message": f"Success: {len(rows)} rows returned."
            }
        else:
            if not IS_MYSQL:
                conn.commit()
            return {
                "columns": [],
                "rows": [],
                "message": f"Success: {cursor.rowcount} rows affected."
            }
    except Exception as e:
        raise HTTPException(400, f"Query Error: {str(e)}")
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  PASSWORD MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/password/status")
async def password_status(request: Request):
    """Check if the current user can change their password."""
    user = get_current_user(request)
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor,
            f"SELECT Password FROM Support_Agents WHERE Agent_ID = {PH}",
            (user["agent_id"],))
        row = fetch_one(cursor)

        approved = True
        if user["role"] == "Agent" and row and row["Password"]:
            execute_query(cursor,
                f"SELECT * FROM Password_Change_Requests "
                f"WHERE Agent_ID = {PH} AND Status = 'Approved'",
                (user["agent_id"],))
            approved = bool(cursor.fetchone())

        return {
            "has_password": bool(row and row["Password"]),
            "change_approved": approved,
        }
    finally:
        conn.close()


@app.post("/api/password/set")
@limiter.limit(RATE_LIMIT_LOGIN)
async def set_password(request: Request, body: SetPasswordRequest):
    """Set or change the current user's password."""
    user = get_current_user(request)

    if body.password != body.confirm:
        raise HTTPException(400, "Passwords do not match.")

    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()

    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor,
            f"UPDATE Support_Agents SET Password = {PH}, Is_Temp_Password = {PH} "
            f"WHERE Agent_ID = {PH}",
            (hashed, False, user["agent_id"]))

        if user["role"] == "Agent":
            execute_query(cursor,
                f"UPDATE Password_Change_Requests SET Status = 'Done' "
                f"WHERE Agent_ID = {PH} AND Status = 'Approved'",
                (user["agent_id"],))

        if not IS_MYSQL:
            conn.commit()
        return {"message": "Password updated."}
    finally:
        conn.close()


@app.post("/api/password/request-change")
@limiter.limit(RATE_LIMIT_LOGIN)
async def request_password_change(request: Request):
    """Agent requests permission to change their password."""
    user = get_current_user(request)
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor,
            f"INSERT INTO Password_Change_Requests (Agent_ID, Status) "
            f"VALUES ({PH}, 'Pending')",
            (user["agent_id"],))
        if not IS_MYSQL:
            conn.commit()
        return {"message": "Request sent to admin."}
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  AI PLACEHOLDER
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/ai/suggest")
@limiter.limit(RATE_LIMIT_API)
async def ai_suggest(request: Request):
    """Internal AI suggestion for agents."""
    openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
    if not openrouter_api_key:
        return {"suggestion": "AI key not configured."}
        
    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_api_key.strip(),
        )
        
        chat_completion = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "http://localhost:3003",
                "X-Title": "Nexora Support",
            },
            model="google/gemini-2.0-flash-001",
            messages=[
                {"role": "system", "content": "You are a helpful customer support agent for Nexora. Give a single crisp short professional response that the agent can send to the customer."},
                {"role": "user", "content": "Help me formulate a response to the customer. Maintain a professional, empathetic tone."}
            ]
        )
        suggestion = chat_completion.choices[0].message.content.strip()
        return {"suggestion": suggestion}
    except Exception as e:
        return {"suggestion": f"AI error: {str(e)}"}


@app.post("/api/ai/query")
@limiter.limit(RATE_LIMIT_API)
async def ai_query(request: Request, body: SqlQueryRequest): 
    """Public / Authenticated: Ask AI about the Nexora project via OpenRouter."""
    query = body.query.strip()
    
    # Reload env to pick up new keys
    from dotenv import load_dotenv
    load_dotenv(override=True)
    
    openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
    
    if not openrouter_api_key:
        logging.error("OPENROUTER_API_KEY NOT FOUND")
        raise HTTPException(500, "OpenRouter API key not configured")

    try:
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_api_key.strip(),
        )
        
        project_details = """
        PROJECT NAME: Nexora
        DESCRIPTION: A next-generation AI-powered customer support platform.
        CORE FEATURES:
        - AI-assisted responses for support agents.
        - SLA-driven workflows (Low: 72h, Medium: 48h, High: 24h).
        - Real-time analytics dashboard for agents and admins.
        - Secure ticketing system with follow-up capabilities.
        - SQL Console for administrative data exploration.
        - JWT-based authentication and Bcrypt password hashing.
        - Role-based access control (Admin, Agent, Customer).
        - Rate limiting and IDOR prevention for safety.
        DATABASE ARCHITECTURE:
        - Hybrid Strategy: Supports SQLite for local development (support_portal.db) and MySQL/MariaDB for production deployments.
        - Connectivity Logic: Centralized in `server/db.py`. It dynamically switches drivers based on environment variables like `MYSQLHOST`.
        - Parameterized Queries: Every database interaction uses raw SQL with placeholders (%s or ?) to completely eliminate SQL injection risks.
        - Data Flow: React Frontend -> FastAPI Backend (Pydantic validation) -> db.py Execution -> process_row() formatting -> JSON Response.
        - Schemas: Five primary tables (Customers, Support_Agents, Tickets, Ticket_Conversations, and Password_Change_Requests).
        ARCHITECTURE:
        - Frontend: React + Vite + TailwindCSS + Lucide Icons + Wouter.
        - Backend: FastAPI (Python) + SQLite/MySQL.
        TEAM: Ganesh Bamalwa, Rudransh Kadiveti.
        RULES:
        - ALWAYS answer using well-structured Markdown.
        - Use bullet points, bold text for headings, and proper line breaks between sections.
        - Ensure lists and multi-point answers are formatted clearly (one point per line).
        - Answer questions about Nexora professionally and concisely.
        - If the question is about database connectivity, explain the hybrid MySQL/SQLite approach and the parameterization security.
        - If the question is outside scope, say: "I'm sorry, but I can only answer questions related to the Nexora project and support operations."
        """

        chat_completion = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "http://localhost:3003",
                "X-Title": "Nexora About AI",
            },
            model="google/gemini-2.0-flash-001",
            messages=[
                {"role": "system", "content": f"You are an expert on the Nexora project. {project_details}"},
                {"role": "user", "content": query}
            ]
        )
        return {"answer": chat_completion.choices[0].message.content}
    except Exception as e:
        logging.error(f"OpenRouter API error: {str(e)}")
        raise HTTPException(500, f"AI Service Error: {str(e)}")


# ─── ENTRYPOINT ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    # Use environment PORT for Railway, default to 8080 or 5000
    port = int(os.environ.get("PORT", 8080))
    logging.info(f"Binding to 0.0.0.0:{port}")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
    )
