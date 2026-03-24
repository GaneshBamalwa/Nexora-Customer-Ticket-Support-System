"""
Database helpers – supports SQLite (dev) and MySQL (production).
All queries are parameterised to prevent SQL injection.
"""

import sqlite3
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

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


# ─── CONNECTION ──────────────────────────────────────────────────────────────

def get_db_conn():
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

def init_db():
    conn = get_db_conn()
    cursor = conn.cursor()

    if IS_MYSQL:
        cursor.execute(
            "CREATE TABLE IF NOT EXISTS Customers ("
            "Customer_ID INT AUTO_INCREMENT PRIMARY KEY, "
            "Name VARCHAR(255), Email_ID VARCHAR(255) UNIQUE)"
        )
        cursor.execute(
            "CREATE TABLE IF NOT EXISTS Support_Agents ("
            "Agent_ID INT AUTO_INCREMENT PRIMARY KEY, "
            "Name VARCHAR(255), Email_ID VARCHAR(255) UNIQUE, "
            "Role VARCHAR(50), Password VARCHAR(255) NULL)"
        )
        cursor.execute(
            "CREATE TABLE IF NOT EXISTS Tickets ("
            "Ticket_ID INT AUTO_INCREMENT PRIMARY KEY, "
            "Customer_ID INT, Agent_ID INT NULL, "
            "Subject VARCHAR(255), Description TEXT, "
            "Status VARCHAR(50) DEFAULT 'Open', Priority VARCHAR(50), "
            "FollowUpCount INT DEFAULT 0, Rating INT NULL, "
            "Created_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "
            "Assigned_At DATETIME NULL, Resolved_At DATETIME NULL, "
            "Due_Date DATETIME NULL)"
        )
        cursor.execute(
            "CREATE TABLE IF NOT EXISTS Ticket_Conversations ("
            "Message_ID INT AUTO_INCREMENT PRIMARY KEY, "
            "Ticket_ID INT, Sender_Role VARCHAR(50), "
            "Message_Text TEXT, "
            "Timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
        )
        cursor.execute(
            "CREATE TABLE IF NOT EXISTS Password_Change_Requests ("
            "Request_ID INT AUTO_INCREMENT PRIMARY KEY, "
            "Agent_ID INT, Status VARCHAR(50) DEFAULT 'Pending', "
            "Requested_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
        )
    else:
        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS Customers (
                Customer_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT, Email_ID TEXT UNIQUE
            );
            CREATE TABLE IF NOT EXISTS Support_Agents (
                Agent_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT, Email_ID TEXT UNIQUE,
                Role TEXT, Password TEXT NULL
            );
            CREATE TABLE IF NOT EXISTS Tickets (
                Ticket_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                Customer_ID INTEGER, Agent_ID INTEGER NULL,
                Subject TEXT, Description TEXT,
                Status TEXT DEFAULT 'Open', Priority TEXT,
                FollowUpCount INTEGER DEFAULT 0, Rating INTEGER NULL,
                Created_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
                Assigned_At DATETIME NULL, Resolved_At DATETIME NULL,
                Due_Date DATETIME NULL
            );
            CREATE TABLE IF NOT EXISTS Ticket_Conversations (
                Message_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                Ticket_ID INTEGER, Sender_Role TEXT,
                Message_Text TEXT,
                Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS Password_Change_Requests (
                Request_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                Agent_ID INTEGER, Status TEXT DEFAULT 'Pending',
                Requested_At DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)

    # Seed default agents with bcrypt passwords
    agents = [
        ("Admin",    "admin@support.com",    "Administrator", _hash_pw("admin1234")),
        ("Ganesh",   "ganesh@support.com",   "Agent",         _hash_pw("ganesh123")),
        ("Rudransh", "rudransh@support.com", "Agent",         _hash_pw("rudransh123")),
    ]
    for name, email, role, pw in agents:
        execute_query(
            cursor,
            f"SELECT Agent_ID FROM Support_Agents WHERE Email_ID = {PH}",
            (email,),
        )
        if not cursor.fetchone():
            execute_query(
                cursor,
                f"INSERT INTO Support_Agents (Name, Email_ID, Role, Password) "
                f"VALUES ({PH}, {PH}, {PH}, {PH})",
                (name, email, role, pw),
            )

    if not IS_MYSQL:
        conn.commit()
    conn.close()
