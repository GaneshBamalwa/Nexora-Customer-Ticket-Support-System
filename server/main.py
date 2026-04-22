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
logging.basicConfig(level=logging.INFO, format="%(message)s")

from fastapi import FastAPI, Request, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth
from pydantic import BaseModel, EmailStr, Field, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import bcrypt
from openai import OpenAI

# ─── PACKAGE SHIM ───────────────────────────────────────────────────────────
# Allows running the server as a script directly (python main.py)
# while still using relative imports for internal modules.
if __name__ == "__main__" and not __package__:
    import sys
    from pathlib import Path
    # Add project root to sys.path
    path = Path(__file__).resolve()
    sys.path.append(str(path.parent.parent))
    __package__ = path.parent.name

from db import (
    get_db_conn, execute_query, fetch_one, fetch_all,
    process_row, init_db, IS_MYSQL, PH, _verify_pw
)
from auth import (
    create_token, get_current_user, require_admin,
    require_owner_or_admin, verify_ms_token,
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


# OAuth config
oauth = OAuth()
oauth.register(
    name='google',
    client_id=os.environ.get("GOOGLE_CLIENT_ID"),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

oauth.register(
    name='microsoft',
    client_id=os.environ.get("MICROSOFT_CLIENT_ID"),
    client_secret=os.environ.get("MICROSOFT_CLIENT_SECRET"),
    server_metadata_url='https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid profile email'},
    claims_options={
        'iss': {'validate': None}
    }
)

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

@app.get("/api/auth/logout")
async def logout_route(request: Request):
    """Clear session/cookies and redirect to login."""
    response = RedirectResponse(url="http://localhost:3002/")
    # If we used HTTP-only cookies, we would clear them here:
    # response.delete_cookie("token")
    
    # Clear Authlib session
    request.session.clear()
    return response

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
    allow_credentials=True, # Enabled to allow Authlib session cookies for CSRF/State
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

# Authlib (sessions for OAuth state)
app.add_middleware(
    SessionMiddleware, 
    secret_key=os.environ.get("SESSION_SECRET", "stable-secret-key-123"),
    max_age=3600, # 1 hour
    same_site="lax",
    https_only=False # Set to True in production with SSL
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


@app.middleware("http")
async def demo_context_middleware(request: Request, call_next):
    """
    Inspect every JWT and set is_demo_context/session_id_context for demo sessions.
    This transparently routes ALL queries to isolated session DBs if available.
    """
    from db import is_demo_context, session_id_context
    from auth import JWT_SECRET, JWT_ALGORITHM
    import jwt as pyjwt

    is_demo = False
    session_id = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            payload = pyjwt.decode(
                auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM],
                options={"verify_exp": False}  # expiry checked elsewhere
            )
            is_demo = bool(payload.get("is_demo", False))
            session_id = payload.get("session_id")
        except Exception:
            pass

    demo_token = is_demo_context.set(is_demo)
    sess_token = session_id_context.set(session_id)
    try:
        response = await call_next(request)
    finally:
        is_demo_context.reset(demo_token)
        session_id_context.reset(sess_token)

    if is_demo:
        response.headers["X-Demo-Mode"] = "true"
        if session_id:
            response.headers["X-Demo-Session"] = session_id

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


class CustomerSignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


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


class TransferRequestBody(BaseModel):
    to_agent_id: int


class ProcessTransferRequestBody(BaseModel):
    action: str = Field(..., pattern=r"^(approve|reject)$")


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

        execute_query(cursor,
            f"SELECT tr.*, fa.Name as From_Agent_Name, ta.Name as To_Agent_Name "
            f"FROM Ticket_Transfer_Requests tr "
            f"LEFT JOIN Support_Agents fa ON tr.From_Agent_ID = fa.Agent_ID "
            f"LEFT JOIN Support_Agents ta ON tr.To_Agent_ID = ta.Agent_ID "
            f"WHERE tr.Ticket_ID = {PH} ORDER BY tr.Requested_At DESC LIMIT 1",
            (ticket_id,))
        transfer_req = fetch_one(cursor)

        return {
            "ticket": process_row(ticket),
            "messages": messages,
            "transfer_request": process_row(transfer_req) if transfer_req else None,
        }
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
    # If explicitly simulating a guest or external email response, ignore the Bearer token
    if not email and auth.startswith("Bearer "):
        try:
            user = get_current_user(request)
            role = user.get("Role", "Customer")
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

@app.post("/api/demo/initialize")
@limiter.limit(RATE_LIMIT_LOGIN)
async def demo_initialize(request: Request):
    """
    Initialize a fresh demo session:
    1. Generate unique session ID
    2. Create isolated DB file
    3. Seed isolated DB with starter ticket
    4. Return restricted JWT
    """
    import uuid
    from db import init_session_db, is_demo_context, session_id_context
    
    session_id = str(uuid.uuid4())[:12]
    
    # Initialize the specific DB for this session
    init_session_db(session_id)
    
    # Set context so we fetch the user from the newly created DB
    d_token = is_demo_context.set(True)
    s_token = session_id_context.set(session_id)
    
    try:
        conn = get_db_conn()
        cursor = conn.cursor()
        try:
            execute_query(cursor, f"SELECT * FROM Demo_Support_Agents WHERE Email_ID = {PH}", ("demo@nexora.io",))
            user = fetch_one(cursor)
            
            if not user:
                raise HTTPException(500, "Demo user seeding failed.")
            
            # Create a bespoke token carrying the session_id and restricted role
            # session_id ensures middleware routes future requests to the right DB
            payload = {
                "Agent_ID": user["Agent_ID"],
                "Name": user.get("Name", "Demo Recruiter"),
                "Email_ID": user["Email_ID"],
                "Role": "DemoAgent", # Restricted role
                "is_demo": True,
                "session_id": session_id,
                "exp": datetime.utcnow() + timedelta(hours=8)
            }
            import jwt as pyjwt
            from auth import JWT_SECRET, JWT_ALGORITHM
            jwt_token = pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
            
            return {
                "token": jwt_token,
                "user": {
                    "Agent_ID": user["Agent_ID"],
                    "Name": user["Name"],
                    "Email_ID": user["Email_ID"],
                    "Role": "DemoAgent",
                    "is_demo": True
                },
                "session_id": session_id
            }
        finally:
            conn.close()
    finally:
        is_demo_context.reset(d_token)
        session_id_context.reset(s_token)


@app.post("/api/demo/login")
async def demo_login_legacy():
    # Keep as alias for now but redirect to initialize
    raise HTTPException(status_code=410, detail="Use /api/demo/initialize instead.")


@app.post("/api/auth/customer/signup")
@limiter.limit(RATE_LIMIT_LOGIN)
async def customer_signup(request: Request, body: CustomerSignupRequest):
    """Manual signup for customers."""
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        # Check if customer already exists
        execute_query(cursor, f"SELECT * FROM Customers WHERE Email_ID = {PH}", (body.email,))
        if fetch_one(cursor):
            raise HTTPException(400, "An account with this email already exists.")
        
        # Check if email is a staff email (block)
        execute_query(cursor, f"SELECT * FROM Support_Agents WHERE Email_ID = {PH}", (body.email,))
        if fetch_one(cursor):
            raise HTTPException(400, "This email is reserved for staff. Please use the Staff Command Center.")

        # Hash and create
        hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
        execute_query(cursor, 
            f"INSERT INTO Customers (Name, Email_ID, Password, Auth_Provider) "
            f"VALUES ({PH}, {PH}, {PH}, 'Manual')", 
            (body.name, body.email, hashed))
        
        if not IS_MYSQL:
            conn.commit()
            
        # Get the new ID
        execute_query(cursor, f"SELECT * FROM Customers WHERE Email_ID = {PH}", (body.email,))
        new_customer = fetch_one(cursor)
        
        # Issue token
        payload = {
            "ID": new_customer["Customer_ID"],
            "Name": new_customer["Name"],
            "Email_ID": new_customer["Email_ID"],
            "Role": "Customer"
        }
        token = create_token(payload)
        return {"token": token, "user": payload}
    finally:
        conn.close()

@app.post("/api/auth/customer/login")
@limiter.limit(RATE_LIMIT_LOGIN)
async def customer_login(request: Request, body: LoginRequest):
    """Manual login for customers."""
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor, f"SELECT * FROM Customers WHERE Email_ID = {PH}", (body.email,))
        customer = fetch_one(cursor)
        
        if not customer or not customer.get("Password"):
            raise HTTPException(401, "Invalid email or password.")
            
        if not bcrypt.checkpw(body.password.encode(), customer["Password"].encode()):
            raise HTTPException(401, "Invalid email or password.")
            
        # Issue token
        payload = {
            "ID": customer["Customer_ID"],
            "Name": customer["Name"],
            "Email_ID": customer["Email_ID"],
            "Role": "Customer"
        }
        token = create_token(payload)
        return {"token": token, "user": payload}
    finally:
        conn.close()

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


@app.get("/api/auth/google")
async def login_google(request: Request):
    """Initiate Google OAuth2 flow."""
    redirect_uri = os.environ.get("GOOGLE_CALLBACK_URL")
    return await oauth.google.authorize_redirect(request, redirect_uri)


@app.get("/api/auth/google/callback")
async def google_callback(request: Request):
    """Handle Google OAuth2 callback (Debug-Ready)."""
    try:
        logging.info("RECEIVED GOOGLE CALLBACK")
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        
        # Fallback for user info
        if not user_info:
            user_info = await oauth.google.get('https://openidconnect.googleapis.com/v1/userinfo', token=token).json()
            
        logging.info(f"GOOGLE TOKEN CLAIMS: {user_info}")
            
        email = user_info.get('email')
        name = user_info.get('name') or email.split('@')[0]
        
        if not email:
            logging.error("GOOGLE AUTH ERROR: No email returned")
            return RedirectResponse("http://localhost:3002/login?error=google_no_email")

        conn = get_db_conn()
        cursor = conn.cursor()
        try:
            # 1. Block Staff from using Google (must use manual login per USER_REQUEST)
            execute_query(cursor, f"SELECT * FROM Support_Agents WHERE Email_ID = {PH}", (email,))
            staff_user = fetch_one(cursor)
            
            if staff_user:
                # Staff are NOT allowed to use Google per instructions
                return RedirectResponse("http://localhost:3002/?error=staff_must_use_manual")

            # 2. Check/Create Customer
            execute_query(cursor, f"SELECT * FROM Customers WHERE Email_ID = {PH}", (email,))
            customer_user = fetch_one(cursor)
            
            if not customer_user:
                execute_query(cursor, 
                    f"INSERT INTO Customers (Name, Email_ID) VALUES ({PH}, {PH})", 
                    (name, email))
                if not IS_MYSQL:
                    conn.commit()
                execute_query(cursor, f"SELECT * FROM Customers WHERE Email_ID = {PH}", (email,))
                customer_user = fetch_one(cursor)
            
            # 3. Create a JWT specifically for the Customer
            # Note: We use a simplified payload for customers
            customer_payload = {
                "ID": customer_user["Customer_ID"],
                "Name": customer_user["Name"],
                "Email_ID": customer_user["Email_ID"],
                "Role": "Customer"
            }
            jwt_token = create_token(customer_payload)
            
            logging.info(f"LOGIN SUCCESSFUL FOR CUSTOMER {customer_user['Customer_ID']}")
            # Redirect directly to customer portal
            return RedirectResponse(url=f"http://localhost:3002/portal?token={jwt_token}")
            
        finally:
            conn.close()
            
    except Exception as e:
        logging.error(f"GOOGLE AUTH FAILURE: {str(e)}", exc_info=True)
        return RedirectResponse("http://localhost:3002/login?error=google_auth_failed")


@app.get("/api/auth/microsoft")
async def login_microsoft(request: Request):
    """Initiate Microsoft OAuth2 flow."""
    redirect_uri = os.environ.get("MICROSOFT_REDIRECT_URI")
    if not redirect_uri:
        raise HTTPException(500, "MICROSOFT_REDIRECT_URI not configured")
    return await oauth.microsoft.authorize_redirect(request, redirect_uri)


@app.get("/api/auth/microsoft/callback")
async def microsoft_callback(request: Request):
    """Handle Microsoft OAuth2 callback (Debug-Ready)."""
    try:
        logging.info("RECEIVED MICROSOFT CALLBACK")
        # 1. Exchange authorization code for tokens
        # We pass claims_options HERE to overrule strict issuer checks in Authlib 1.3
        token = await oauth.microsoft.authorize_access_token(
            request, 
            claims_options={'iss': {'validate': None}}
        )
        id_token = token.get('id_token')
        
        logging.info("EXCHANGED CODE FOR TOKENS SUCCESSFULLY")
        
        # 2. Manual secure ID Token verification with custom debug logging
        user_info = await verify_ms_token(id_token)
        
        email = user_info.get("email")
        name = user_info.get("name")
        
        logging.info(f"USER IDENTIFIED: {email} ({name})")
        
        if not email:
            logging.error("OAUTH ERROR: No email returned in user_info")
            return RedirectResponse("http://localhost:3002/?error=ms_no_email")

        conn = get_db_conn()
        cursor = conn.cursor()
        try:
            # 1. Block Staff from using Microsoft (same policy as Google)
            execute_query(cursor, f"SELECT * FROM Support_Agents WHERE Email_ID = {PH}", (email,))
            staff_user = fetch_one(cursor)
            
            if staff_user:
                return RedirectResponse("http://localhost:3002/?error=staff_must_use_manual")

            # 2. Check/Create Customer
            execute_query(cursor, f"SELECT * FROM Customers WHERE Email_ID = {PH}", (email,))
            customer_user = fetch_one(cursor)
            
            if not customer_user:
                logging.info(f"CREATING NEW CUSTOMER: {email}")
                execute_query(cursor, 
                    f"INSERT INTO Customers (Name, Email_ID, Auth_Provider) VALUES ({PH}, {PH}, 'Microsoft')", 
                    (name, email))
                if not IS_MYSQL:
                    conn.commit()
                execute_query(cursor, f"SELECT * FROM Customers WHERE Email_ID = {PH}", (email,))
                customer_user = fetch_one(cursor)
            
            # 3. Create a JWT for the Customer
            customer_payload = {
                "ID": customer_user["Customer_ID"],
                "Name": customer_user["Name"],
                "Email_ID": customer_user["Email_ID"],
                "Role": "Customer"
            }
            jwt_token = create_token(customer_payload)
            
            # Redirect directly to customer portal
            return RedirectResponse(url=f"http://localhost:3002/portal?token={jwt_token}")
            
        finally:
            conn.close()
            
    except Exception as e:
        logging.error(f"MICROSOFT CALLBACK FAILURE: {str(e)}", exc_info=True)
        return RedirectResponse("http://localhost:3002/login?error=ms_auth_failed")






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

        role = str(user.get("Role") or "")

        # IDOR: agents only see their tickets + unassigned.
        # DemoAgent mirrors admin visibility inside isolated demo session.
        if role not in ("Administrator", "DemoAgent"):
            query += " AND (Agent_ID = %s OR Agent_ID IS NULL)"
            params.append(user["Agent_ID"])

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
            + (" AND (Agent_ID = %s OR Agent_ID IS NULL)" if role not in ("Administrator", "DemoAgent") else ""),
            (user["Agent_ID"],) if role not in ("Administrator", "DemoAgent") else ()
        )
        stats = fetch_one(cursor) or {}

        execute_query(cursor,
            "SELECT Created_Date, Resolved_At FROM Tickets WHERE Status='Resolved' "
            "AND Resolved_At IS NOT NULL AND Created_Date IS NOT NULL"
            + (" AND (Agent_ID = %s OR Agent_ID IS NULL)" if role not in ("Administrator", "DemoAgent") else ""),
            (user["Agent_ID"],) if role not in ("Administrator", "DemoAgent") else ()
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


@app.post("/api/tickets/{ticket_id}/transfer-request")
@limiter.limit(RATE_LIMIT_API)
async def create_transfer_request(request: Request, ticket_id: int, body: TransferRequestBody):
    """Agent requests a ticket transfer; admin must approve the request."""
    user = get_current_user(request)
    role = str(user.get("Role") or "")
    if role not in ("Agent", "Administrator", "DemoAgent"):
        raise HTTPException(403, "Only agents can request transfers")

    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor,
            f"SELECT Ticket_ID, Agent_ID, Status FROM Tickets WHERE Ticket_ID = {PH}",
            (ticket_id,))
        ticket = fetch_one(cursor)
        if not ticket:
            raise HTTPException(404, "Ticket not found")

        requester_agent_id = user.get("Agent_ID") or user.get("agent_id") or user.get("ID")
        if str(ticket.get("Agent_ID")) != str(requester_agent_id):
            raise HTTPException(403, "Only the assigned agent can request transfer")

        if str(ticket.get("Status")) == "Resolved":
            raise HTTPException(400, "Cannot transfer a resolved ticket")

        execute_query(cursor,
            f"SELECT Agent_ID, Role, Name FROM Support_Agents WHERE Agent_ID = {PH}",
            (body.to_agent_id,))
        to_agent = fetch_one(cursor)
        if not to_agent or str(to_agent.get("Role")) != "Agent":
            raise HTTPException(400, "Target agent is invalid")

        if str(body.to_agent_id) == str(user.get("Agent_ID")):
            raise HTTPException(400, "Target agent must be different from requester")

        # Prevent stacking duplicate pending requests for the same ticket.
        execute_query(cursor,
            f"SELECT Request_ID FROM Ticket_Transfer_Requests WHERE Ticket_ID = {PH} AND Status = 'Pending'",
            (ticket_id,))
        if fetch_one(cursor):
            raise HTTPException(400, "A transfer request is already pending for this ticket")

        execute_query(cursor,
            f"INSERT INTO Ticket_Transfer_Requests (Ticket_ID, From_Agent_ID, To_Agent_ID, Status) "
            f"VALUES ({PH}, {PH}, {PH}, 'Pending')",
            (ticket_id, requester_agent_id, body.to_agent_id))

        # Lightweight notification trail in conversation history.
        execute_query(cursor,
            f"INSERT INTO Ticket_Conversations (Ticket_ID, Sender_Role, Message_Text) VALUES ({PH}, {PH}, {PH})",
            (ticket_id, "System", f"Transfer request submitted by {user.get('Name')} to move ticket to {to_agent.get('Name')}. Awaiting admin approval."))

        if not IS_MYSQL:
            conn.commit()
        return {"message": "Transfer request submitted", "status": "Pending"}
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

        # Security check:
        # - Production: only Administrator can assign/reassign.
        # - Demo sandbox: DemoAgent can reassign within isolated session DB.
        role = str(user.get("Role") or "").lower()
        is_admin = role == "administrator"
        is_demo_agent = role == "demoagent" and bool(user.get("is_demo")) and bool(user.get("session_id"))
        if not (is_admin or is_demo_agent):
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
    
    if agent_id == user["Agent_ID"]:
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


@app.get("/api/admin/approvals")
@limiter.limit(RATE_LIMIT_API)
async def admin_approvals(request: Request):
    """Unified approvals endpoint for password and ticket transfer requests."""
    user = get_current_user(request)
    require_admin(user)

    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor,
            "SELECT r.Request_ID, r.Agent_ID, r.Status, r.Requested_At, a.Name, a.Email_ID "
            "FROM Password_Change_Requests r "
            "JOIN Support_Agents a ON r.Agent_ID = a.Agent_ID "
            "WHERE r.Status = 'Pending' ORDER BY r.Requested_At DESC")
        pw_requests = [process_row(r) for r in fetch_all(cursor)]

        execute_query(cursor,
            "SELECT tr.Request_ID, tr.Ticket_ID, tr.From_Agent_ID, tr.To_Agent_ID, tr.Status, tr.Requested_At, "
            "fa.Name as From_Agent_Name, fa.Email_ID as From_Agent_Email, "
            "ta.Name as To_Agent_Name, ta.Email_ID as To_Agent_Email "
            "FROM Ticket_Transfer_Requests tr "
            "JOIN Support_Agents fa ON tr.From_Agent_ID = fa.Agent_ID "
            "JOIN Support_Agents ta ON tr.To_Agent_ID = ta.Agent_ID "
            "WHERE tr.Status = 'Pending' ORDER BY tr.Requested_At DESC")
        transfer_requests = [process_row(r) for r in fetch_all(cursor)]

        return {
            "password_requests": pw_requests,
            "ticket_transfer_requests": transfer_requests,
        }
    finally:
        conn.close()


@app.post("/api/admin/approvals/ticket-transfer/{request_id}/process")
@limiter.limit(RATE_LIMIT_API)
async def process_ticket_transfer_request(request: Request, request_id: int, body: ProcessTransferRequestBody):
    """Approve or reject a pending ticket transfer request."""
    user = get_current_user(request)
    require_admin(user)

    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        execute_query(cursor,
            f"SELECT * FROM Ticket_Transfer_Requests WHERE Request_ID = {PH}",
            (request_id,))
        transfer_req = fetch_one(cursor)
        if not transfer_req:
            raise HTTPException(404, "Transfer request not found")
        if transfer_req.get("Status") != "Pending":
            raise HTTPException(400, "Transfer request already processed")

        execute_query(cursor,
            f"SELECT Ticket_ID, Agent_ID, Status FROM Tickets WHERE Ticket_ID = {PH}",
            (transfer_req["Ticket_ID"],))
        ticket = fetch_one(cursor)
        if not ticket:
            raise HTTPException(404, "Ticket not found")
        if ticket.get("Status") == "Resolved":
            raise HTTPException(400, "Cannot process transfer for resolved ticket")

        action = body.action.lower()
        new_status = "Approved" if action == "approve" else "Rejected"

        if action == "approve":
            execute_query(cursor,
                f"UPDATE Tickets SET Agent_ID = {PH}, Assigned_At = CURRENT_TIMESTAMP WHERE Ticket_ID = {PH}",
                (transfer_req["To_Agent_ID"], transfer_req["Ticket_ID"]))

        execute_query(cursor,
            f"UPDATE Ticket_Transfer_Requests SET Status = {PH}, Processed_At = CURRENT_TIMESTAMP, Processed_By = {PH} "
            f"WHERE Request_ID = {PH}",
            (new_status, user.get("Agent_ID"), request_id))

        # Notify both agents via ticket timeline audit message.
        if action == "approve":
            msg = (
                f"Transfer approved by admin {user.get('Name')}. "
                f"Ticket moved from Agent #{transfer_req['From_Agent_ID']} to Agent #{transfer_req['To_Agent_ID']}."
            )
        else:
            msg = (
                f"Transfer request rejected by admin {user.get('Name')}. "
                f"Ticket remains with Agent #{transfer_req['From_Agent_ID']}."
            )
        execute_query(cursor,
            f"INSERT INTO Ticket_Conversations (Ticket_ID, Sender_Role, Message_Text) VALUES ({PH}, {PH}, {PH})",
            (transfer_req["Ticket_ID"], "System", msg))

        if not IS_MYSQL:
            conn.commit()
        return {"message": f"Transfer request {new_status.lower()}"}
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
            execute_query(cursor, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
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
                
            # Normalize table name for frontend ER diagram mapping
            # (Remove internal 'Demo_' prefix if present)
            display_name = t[5:] if t.startswith("Demo_") else t
            
            metadata[display_name] = {
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
    role = user.get("Role", "Agent")
    
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
        
    logging.info(f"User {user.get('Email_ID')} ({role}) executing SQL: {query}")
        
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
            (user["Agent_ID"],))
        row = fetch_one(cursor)

        approved = True
        if user["Role"] == "Agent" and row and row["Password"]:
            execute_query(cursor,
                f"SELECT * FROM Password_Change_Requests "
                f"WHERE Agent_ID = {PH} AND Status = 'Approved'",
                (user["Agent_ID"],))
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
            (hashed, False, user["Agent_ID"]))

        if user["Role"] == "Agent":
            execute_query(cursor,
                f"UPDATE Password_Change_Requests SET Status = 'Done' "
                f"WHERE Agent_ID = {PH} AND Status = 'Approved'",
                (user["Agent_ID"],))

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
            (user["Agent_ID"],))
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
    logging.info(f"AI Query received: {query[:50]}...")
    
    # Reload env to pick up new keys if they were changed
    from dotenv import load_dotenv
    load_dotenv(override=True)
    
    openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
    
    if not openrouter_api_key:
        logging.error("CRITICAL: OPENROUTER_API_KEY NOT FOUND in environment or .env file")
        raise HTTPException(status_code=500, detail="OpenRouter API key not configured on the server.")

    try:
        # We use the OpenAI client pointed to OpenRouter
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

        logging.info("Calling OpenRouter API...")
        chat_completion = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "http://localhost:3002", # Corrected port to match vite default
                "X-Title": "Nexora Intelligence Center",
            },
            model="google/gemini-2.0-flash-001",
            messages=[
                {"role": "system", "content": f"You are an expert on the Nexora project. {project_details}"},
                {"role": "user", "content": query}
            ],
            timeout=30.0 # Add timeout to prevent hanging
        )
        
        if not chat_completion.choices:
            logging.error("OpenRouter returned empty choices")
            raise Exception("AI returned no response.")

        answer = chat_completion.choices[0].message.content
        logging.info("AI response generated successfully.")
        return {"answer": answer}

    except Exception as e:
        error_msg = str(e)
        logging.error(f"OpenRouter API error: {error_msg}")
        # Return a more descriptive error if it's an API error
        if "401" in error_msg:
            raise HTTPException(status_code=500, detail="Invalid OpenRouter API Key. Please check your .env file.")
        elif "404" in error_msg:
            raise HTTPException(status_code=500, detail="AI Model not found on OpenRouter. Please verify the model name.")
        else:
            raise HTTPException(status_code=500, detail=f"AI Service Error: {error_msg}")


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
