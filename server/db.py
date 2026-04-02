"""
Database helpers – supports SQLite (dev) and MySQL (production).
All queries are parameterised to prevent SQL injection.
"""

import sqlite3
import os
import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextvars import ContextVar

import bcrypt

# ─── CONFIG ──────────────────────────────────────────────────────────────────

MYSQL_HOST = os.environ.get("MYSQLHOST")
MYSQL_USER = os.environ.get("MYSQLUSER")
MYSQL_PASS = os.environ.get("MYSQLPASSWORD")
MYSQL_DB   = os.environ.get("MYSQLDATABASE")
MYSQL_PORT = os.environ.get("MYSQLPORT", "3306")

IS_MYSQL = bool(MYSQL_HOST)
DB_PATH  = os.path.join(os.path.dirname(__file__), "support_portal.db")
PH       = "%s" if IS_MYSQL else "?"

# Global context for demo routing
is_demo_context: ContextVar[bool] = ContextVar("is_demo", default=False)
session_id_context: ContextVar[Optional[str]] = ContextVar("session_id", default=None)

def get_session_db_path(session_id: str) -> str:
    """Get the path for a session-specific isolated database."""
    base_dir = os.path.dirname(DB_PATH)
    demo_dir = os.path.join(base_dir, "sessions")
    if not os.path.exists(demo_dir):
        os.makedirs(demo_dir, exist_ok=True)
    return os.path.join(demo_dir, f"support_portal_demo_{session_id}.db")

# ─── CONNECTION ──────────────────────────────────────────────────────────────

def get_db_conn():
    session_id = session_id_context.get()
    
    if session_id:
        # Connect to isolated session DB
        path = get_session_db_path(session_id)
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        return conn

    if IS_MYSQL:
        import mysql.connector
        return mysql.connector.connect(
            host=MYSQL_HOST, user=MYSQL_USER, password=MYSQL_PASS,
            database=MYSQL_DB, port=MYSQL_PORT, autocommit=True,
            connection_timeout=10,
        )
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def execute_query(cursor, query: str, params: tuple = ()):
    is_demo = is_demo_context.get()
    session_id = session_id_context.get()
    
    # If we are in an isolated session DB, the tables might be named with or without Demo_ prefix.
    # To keep compatibility with existing seeds that use "Demo_Tickets", we'll keep the regex
    # but only if we are using the shared file system.
    # Actually, the user wants us to NOT touch production tables. 
    # If session_id is active, we are ALREADY in a different file.
    
    if is_demo and not session_id:
        # Legacy shared demo tables in the main DB
        tables = [
            "Customers", "Support_Agents", "Tickets", 
            "Ticket_Conversations", "Password_Change_Requests"
        ]
        for table in tables:
            pattern = rf'\b{table}\b'
            query = re.sub(pattern, f"Demo_{table}", query, flags=re.IGNORECASE)
    
    # If session_id is set, the isolated file ALREADY has "Demo_" tables because of how init_db works.
    # So we still need the regex if we want to use the same queries.
    if session_id:
        tables = [
            "Customers", "Support_Agents", "Tickets", 
            "Ticket_Conversations", "Password_Change_Requests"
        ]
        for table in tables:
            pattern = rf'\b{table}\b'
            query = re.sub(pattern, f"Demo_{table}", query, flags=re.IGNORECASE)

    if not IS_MYSQL:
        query = query.replace("%s", "?")
    cursor.execute(query, params)


def fetch_one(cursor) -> Optional[Dict[str, Any]]:
    row = cursor.fetchone()
    if not row:
        return None
    if IS_MYSQL:
        return dict(zip(cursor.column_names, row))
    return dict(row)


def fetch_all(cursor) -> List[Dict[str, Any]]:
    rows = cursor.fetchall()
    if IS_MYSQL:
        return [dict(zip(cursor.column_names, r)) for r in rows]
    return [dict(r) for r in rows]


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def _hash_pw(plain: str) -> str:
    """Bcrypt hash (replaces the original SHA-256 approach)."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def _verify_pw(plain: str, hashed: str) -> bool:
    """Check a plaintext password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def process_row(d: Optional[Dict]) -> Dict:
    if not d:
        return {}
    for key in ("Created_Date", "Assigned_At", "Resolved_At",
                "Due_Date", "Requested_At", "Timestamp"):
        if key in d and d[key] and isinstance(d[key], str):
            try:
                d[key] = datetime.strptime(
                    d[key].split(".")[0], "%Y-%m-%d %H:%M:%S"
                ).isoformat()
            except Exception:
                pass
        elif key in d and isinstance(d[key], datetime):
            d[key] = d[key].isoformat()
    return d


# ─── SCHEMA INIT ─────────────────────────────────────────────────────────────


def _init_tables(cursor, prefix=""):
    """Helper to create tables with optional prefix."""
    p = prefix
    if IS_MYSQL:
        cursor.execute(f"CREATE TABLE IF NOT EXISTS {p}Customers (Customer_ID INT AUTO_INCREMENT PRIMARY KEY, Name VARCHAR(255), Email_ID VARCHAR(255) UNIQUE)")
        cursor.execute(f"CREATE TABLE IF NOT EXISTS {p}Support_Agents (Agent_ID INT AUTO_INCREMENT PRIMARY KEY, Name VARCHAR(255), Email_ID VARCHAR(255) UNIQUE, Role VARCHAR(50), Password VARCHAR(255) NULL, Is_Temp_Password BOOLEAN DEFAULT FALSE, Auth_Provider VARCHAR(50) DEFAULT 'Local')")
        cursor.execute(f"CREATE TABLE IF NOT EXISTS {p}Tickets (Ticket_ID INT AUTO_INCREMENT PRIMARY KEY, Customer_ID INT, Agent_ID INT NULL, Subject VARCHAR(255), Description TEXT, Status VARCHAR(50) DEFAULT 'Open', Priority VARCHAR(50), FollowUpCount INT DEFAULT 0, Rating INT NULL, Created_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, Assigned_At DATETIME NULL, Resolved_At DATETIME NULL, Due_Date DATETIME NULL)")
        cursor.execute(f"CREATE TABLE IF NOT EXISTS {p}Ticket_Conversations (Message_ID INT AUTO_INCREMENT PRIMARY KEY, Ticket_ID INT, Sender_Role VARCHAR(50), Message_Text TEXT, Timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
        cursor.execute(f"CREATE TABLE IF NOT EXISTS {p}Password_Change_Requests (Request_ID INT AUTO_INCREMENT PRIMARY KEY, Agent_ID INT, Status VARCHAR(50) DEFAULT 'Pending', Requested_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
    else:
        cursor.executescript(f"""
            CREATE TABLE IF NOT EXISTS {p}Customers (Customer_ID INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT, Email_ID TEXT UNIQUE);
            CREATE TABLE IF NOT EXISTS {p}Support_Agents (Agent_ID INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT, Email_ID TEXT UNIQUE, Role TEXT, Password TEXT NULL, Is_Temp_Password INTEGER DEFAULT 0, Auth_Provider TEXT DEFAULT 'Local');
            CREATE TABLE IF NOT EXISTS {p}Tickets (Ticket_ID INTEGER PRIMARY KEY AUTOINCREMENT, Customer_ID INTEGER, Agent_ID INTEGER NULL, Subject TEXT, Description TEXT, Status TEXT DEFAULT 'Open', Priority TEXT, FollowUpCount INTEGER DEFAULT 0, Rating INTEGER NULL, Created_Date DATETIME DEFAULT CURRENT_TIMESTAMP, Assigned_At DATETIME NULL, Resolved_At DATETIME NULL, Due_Date DATETIME NULL);
            CREATE TABLE IF NOT EXISTS {p}Ticket_Conversations (Message_ID INTEGER PRIMARY KEY AUTOINCREMENT, Ticket_ID INTEGER, Sender_Role TEXT, Message_Text TEXT, Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS {p}Password_Change_Requests (Request_ID INTEGER PRIMARY KEY AUTOINCREMENT, Agent_ID INTEGER, Status TEXT DEFAULT 'Pending', Requested_At DATETIME DEFAULT CURRENT_TIMESTAMP);
        """)

def init_db():
    conn = get_db_conn()
    cursor = conn.cursor()

    # 1. Create Production Tables
    _init_tables(cursor)

    # 2. Migrate production columns
    def _migrate(p=""):
        if IS_MYSQL:
            try: cursor.execute(f"ALTER TABLE {p}Support_Agents ADD COLUMN Is_Temp_Password BOOLEAN DEFAULT FALSE")
            except: pass
            try: cursor.execute(f"ALTER TABLE {p}Support_Agents ADD COLUMN Auth_Provider VARCHAR(50) DEFAULT 'Local'")
            except: pass
        else:
            try: cursor.execute(f"ALTER TABLE {p}Support_Agents ADD COLUMN Is_Temp_Password INTEGER DEFAULT 0")
            except: pass
            try: cursor.execute(f"ALTER TABLE {p}Support_Agents ADD COLUMN Auth_Provider TEXT DEFAULT 'Local'")
            except: pass

    _migrate()

    # 3. Demo Mode: create + migrate + seed demo tables (AFTER prod, isolated)
    if os.environ.get("DEMO_MODE") == "true":
        _init_tables(cursor, prefix="Demo_")
        _migrate("Demo_")
        seed_demo_data(cursor)

    # 4. Seed default prod agents
    agents = [
        ("Admin",    "admin@support.com",    "Administrator", _hash_pw("admin1234")),
        ("Ganesh",   "ganesh@support.com",   "Agent",         _hash_pw("ganesh123")),
        ("Rudransh", "rudransh@support.com", "Agent",         _hash_pw("rudransh123")),
    ]
    for name, email, role, pw in agents:
        cursor.execute(f"SELECT Agent_ID FROM Support_Agents WHERE Email_ID = {PH}", (email,))
        if not cursor.fetchone():
            cursor.execute(f"INSERT INTO Support_Agents (Name, Email_ID, Role, Password) VALUES ({PH}, {PH}, {PH}, {PH})", (name, email, role, pw))

    if not IS_MYSQL:
        conn.commit()
    conn.close()

def init_session_db(session_id: str):
    """Create and seed an isolated database for a specific session."""
    path = get_session_db_path(session_id)
    
    # If it exists, wipe it (or we could keep it if it's the same session)
    if os.path.exists(path):
        os.remove(path)
        
    conn = sqlite3.connect(path)
    cursor = conn.cursor()
    
    # Initialize schema
    _init_tables(cursor, prefix="Demo_")
    
    # Seed data
    seed_demo_data(cursor)
    
    # Add a specific starter ticket for Step 1
    cursor.execute("SELECT Customer_ID FROM Demo_Customers WHERE Email_ID = ?", ("elon@starlink.io",))
    cust = cursor.fetchone()
    if cust:
        cid = cust[0]
        cursor.execute(
            "INSERT INTO Demo_Tickets (Customer_ID, Subject, Description, Priority, Status) "
            "VALUES (?, ?, ?, ?, ?)",
            (cid, "URGENT: Falcon 9 Autopilot Glitch", "The thrusters are firing at 400% capacity during hover slam. Major mission risk.", "High", "Open")
        )
        cursor.execute("SELECT last_insert_rowid()")
        tid = cursor.fetchone()[0]
        cursor.execute(
            "INSERT INTO Demo_Ticket_Conversations (Ticket_ID, Sender_Role, Message_Text) "
            "VALUES (?, ?, ?)",
            (tid, "Customer", "Please help! The Falcon 9 thrusters are completely out of sync. It keeps aborting the hover slam sequence!")
        )
    
    conn.commit()
    conn.close()

def seed_demo_data(cursor):
    """
    Idempotent demo seed: 3 agents, 4 customers, 25 tickets spanning 7 days.
    Populates all Operational Intel charts.
    """
    from datetime import datetime, timedelta

    # ── 1. Demo Agents ─────────────────────────────────────────────────────────
    demo_agents = [
        ("Demo Recruiter", "demo@nexora.io",      "Administrator"),
        ("Alex Rivera",    "alex@demo.nexora.io",  "Agent"),
        ("Priya Sharma",   "priya@demo.nexora.io", "Agent"),
        ("Max Chen",       "max@demo.nexora.io",   "Agent"),
    ]
    agent_ids = {}
    for name, email, role in demo_agents:
        cursor.execute(f"SELECT Agent_ID FROM Demo_Support_Agents WHERE Email_ID = {PH}", (email,))
        row = cursor.fetchone()
        if row:
            agent_ids[email] = row[0] if not IS_MYSQL else row["Agent_ID"]
        else:
            pw = _hash_pw("demo-recruiter-2026") if role == "Administrator" else _hash_pw("agent123")
            cursor.execute(
                f"INSERT INTO Demo_Support_Agents (Name, Email_ID, Role, Password) VALUES ({PH},{PH},{PH},{PH})",
                (name, email, role, pw)
            )
            cursor.execute(f"SELECT Agent_ID FROM Demo_Support_Agents WHERE Email_ID = {PH}", (email,))
            row = cursor.fetchone()
            agent_ids[email] = row[0] if not IS_MYSQL else row["Agent_ID"]

    # ── 2. Demo Customers ───────────────────────────────────────────────────────
    cursor.execute(f"SELECT COUNT(*) FROM Demo_Customers")
    count_row = cursor.fetchone()
    already_seeded = (count_row[0] if not IS_MYSQL else list(count_row.values())[0]) > 0

    if already_seeded:
        return  # Idempotent: skip if data already exists

    demo_customers = [
        ("Elon Musk",    "elon@starlink.io"),
        ("Jensen Huang", "jensen@nvidia.demo"),
        ("Sara Okonkwo", "sara@fintech.demo"),
        ("Rohan Das",    "rohan@edtech.demo"),
    ]
    cust_ids = []
    for name, email in demo_customers:
        cursor.execute(f"INSERT INTO Demo_Customers (Name, Email_ID) VALUES ({PH},{PH})", (name, email))
        cursor.execute(f"SELECT Customer_ID FROM Demo_Customers WHERE Email_ID = {PH}", (email,))
        row = cursor.fetchone()
        cust_ids.append(row[0] if not IS_MYSQL else row["Customer_ID"])

    alex_id  = agent_ids["alex@demo.nexora.io"]
    priya_id = agent_ids["priya@demo.nexora.io"]
    max_id   = agent_ids["max@demo.nexora.io"]

    now = datetime.utcnow()
    def ago(days=0, hours=0):
        return (now - timedelta(days=days, hours=hours)).strftime("%Y-%m-%d %H:%M:%S")

    # ── 3. Tickets ─────────────────────────────────────────────────────────────
    # Format: (customer_idx, agent_id, subject, description, priority, status, created_ago_days, resolved_offset_hrs, rating)
    tickets_data = [
        # Elon (cust 0) — High priority cluster, recent
        (0, alex_id,  "Starlink Terminal Offline",       "Terminal dropped from constellation. Need emergency restore.",       "High",   "Resolved", 6,  4,  5),
        (0, priya_id, "Mars Comms Latency Spike",        "Round-trip ping to Mars base exceeded 40 min. SLA breach.",          "High",   "Resolved", 6,  6,  4),
        (0, max_id,   "Falcon 9 Telemetry Gap",          "10-second telemetry blackout during stage separation.",              "High",   "Open",     5,  None, None),
        (0, alex_id,  "Crew Dragon Docking Issue",       "Auto-dock sequence aborted at 1.2m. Manual override needed.",       "High",   "Pending",  4,  None, None),
        (0, priya_id, "Satellite Orbital Decay Alert",   "Sat-7 losing altitude faster than model predicts.",                  "Medium", "Resolved", 4,  8,  5),

        # Jensen (cust 1) — GPU/AI infra issues
        (1, max_id,   "H100 Cluster OOM on LLM Fine-tune", "All 8 GPUs OOM during 70B model fine-tune. Need advice.",         "High",   "Resolved", 5,  3,  5),
        (1, alex_id,  "CUDA Driver Version Conflict",    "Driver 535 breaking cuDNN 8.7 on DGX Station.",                     "Medium", "Resolved", 5,  5,  4),
        (1, priya_id, "NVLink Fabric Unstable",          "NVLink bandwidth dropping from 600 to 200 GB/s randomly.",          "High",   "Open",     3,  None, None),
        (1, max_id,   "TensorRT Inference Perf Degraded","Batch=1 latency up 40% after upgrade to TRT 9.0.",                  "Medium", "Pending",  3,  None, None),
        (1, alex_id,  "Grace Hopper Thermal Throttle",   "GH200 throttling at 85°C. Cooling config required.",                "Low",    "Resolved", 2,  2,  3),

        # Sara (cust 2) — FinTech / compliance
        (2, priya_id, "Payment Gateway Timeout",         "3% of transactions timing out at checkout. Causes revenue loss.",   "High",   "Resolved", 7,  2,  5),
        (2, max_id,   "KYC Verification Loop",           "Customers stuck in infinite KYC re-verification cycle.",            "High",   "Resolved", 6,  4,  4),
        (2, alex_id,  "Fraud Model False Positives",     "Fraud model flagging 8% of valid transactions as suspicious.",      "Medium", "Open",     5,  None, None),
        (2, priya_id, "GDPR Data Export Broken",         "User data export endpoint returning 500. Compliance deadline:",     "High",   "Resolved", 4,  3,  5),
        (2, max_id,   "Dashboard Load Time > 10s",       "Admin dashboard timing out for accounts with >10k transactions.",   "Medium", "Pending",  2,  None, None),
        (2, alex_id,  "Bank Reconciliation Mismatch",    "Nightly reconciliation showing $240 delta. Root cause unknown.",    "High",   "Open",     1,  None, None),
        (2, priya_id, "Webhook Signature Failures",      "Stripe webhooks rejected — HMAC mismatch after cert rotation.",    "Low",    "Resolved", 1,  1,  4),

        # Rohan (cust 3) — EdTech platform
        (3, max_id,   "Video Streaming Buffering",       "Live lectures buffering every 30s for rural users on 4G.",          "High",   "Resolved", 7,  5,  4),
        (3, alex_id,  "Assignment Upload Failing",       "PDF uploads failing silently. Students losing work.",               "High",   "Resolved", 6,  3,  5),
        (3, priya_id, "Quiz Timer Desyncing",            "Quiz timers running at 2x speed on Safari iOS 17.",                 "Medium", "Open",     5,  None, None),
        (3, max_id,   "Certificate Generation Delay",    "Certificates taking 48h to generate instead of 5min.",             "Low",    "Resolved", 4,  6,  3),
        (3, alex_id,  "Gradebook Export Corrupt",        "Excel export for gradebook has merged cells corrupted.",            "Medium", "Pending",  3,  None, None),
        (3, priya_id, "Discussion Forum Spam Wave",      "Bot accounts posting 200+ spam threads per hour.",                  "High",   "Open",     2,  None, None),
        (3, max_id,   "Mobile App Crash on Login",       "iOS 17.3 app crashes immediately on login screen.",                "High",   "Resolved", 1,  2,  5),
        (3, alex_id,  "SSO Integration Broken",          "Google SSO stopped working after OAuth scope change.",              "Medium", "Open",     0,  None, None),
    ]

    for (ci, agent_id, subject, description, priority, status, days_ago, resolve_hrs, rating) in tickets_data:
        cust_id = cust_ids[ci]
        created_at = ago(days=days_ago)
        resolved_at = ago(days=days_ago, hours=-(resolve_hrs or 0)) if resolve_hrs else None
        assigned_at  = ago(days=days_ago, hours=-1)

        if resolved_at:
            cursor.execute(
                f"INSERT INTO Demo_Tickets (Customer_ID, Agent_ID, Subject, Description, Priority, Status, Rating, "
                f"Created_Date, Assigned_At, Resolved_At) VALUES ({PH},{PH},{PH},{PH},{PH},{PH},{PH},{PH},{PH},{PH})",
                (cust_id, agent_id, subject, description, priority, status, rating,
                 created_at, assigned_at, resolved_at)
            )
        else:
            cursor.execute(
                f"INSERT INTO Demo_Tickets (Customer_ID, Agent_ID, Subject, Description, Priority, Status, "
                f"Created_Date, Assigned_At) VALUES ({PH},{PH},{PH},{PH},{PH},{PH},{PH},{PH})",
                (cust_id, agent_id, subject, description, priority, status, created_at, assigned_at)
            )

    # ── 4. Conversations ────────────────────────────────────────────────────────
    cursor.execute("SELECT Ticket_ID FROM Demo_Tickets LIMIT 6")
    rows = cursor.fetchall()
    ticket_sample = [r[0] if not IS_MYSQL else r["Ticket_ID"] for r in rows]
    convos = [
        ("Customer", "Hi team, this is a blocker for our launch. Please escalate."),
        ("Agent",    "Acknowledged! I'm looking into this right now. Will update you within 1 hour."),
        ("Customer", "Thank you. Our entire team is waiting on this."),
        ("Agent",    "Root cause identified. Deploying a fix now."),
        ("Customer", "Amazing — it's working now! Really appreciate the fast turnaround."),
        ("Agent",    "Glad to help! I'm marking this as resolved. Please rate your experience."),
    ]
    for tid in ticket_sample:
        for sender, msg in convos:
            cursor.execute(
                f"INSERT INTO Demo_Ticket_Conversations (Ticket_ID, Sender_Role, Message_Text) "
                f"VALUES ({PH},{PH},{PH})",
                (tid, sender, msg)
            )



def _showcase_triggers():
    """ 
    Showcase triggers for documentation/presentation purposes.
    These are not executed by the application logic.
    """
    # Trigger to log ticket creation
    trigger_after_insert = """
    CREATE TRIGGER after_ticket_insert
    AFTER INSERT ON Tickets
    FOR EACH ROW
    BEGIN
        INSERT INTO Conversations(message_id, ticket_id, sender_role, message)
        VALUES (0, NEW.ticket_id, 'SYSTEM', 'Ticket Created');
    END;
    """

    # Trigger to log ticket updates
    trigger_after_update = """
    CREATE TRIGGER after_ticket_update
    AFTER UPDATE ON Tickets
    FOR EACH ROW
    BEGIN
        INSERT INTO Conversations(message_id, ticket_id, sender_role, message)
        VALUES (0, NEW.ticket_id, 'SYSTEM', 'Ticket Updated');
    END;
    """
