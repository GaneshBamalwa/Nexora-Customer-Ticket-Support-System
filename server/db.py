"""
Database helpers – Migrated to psycopg (v3) for Python 3.14 compatibility.
All queries are parameterised to prevent SQL injection.
"""

import os
import logging
import re
from datetime import datetime
from typing import Optional, List, Dict, Any

import psycopg
from psycopg.rows import dict_row
import bcrypt

# ─── CONFIG ──────────────────────────────────────────────────────────────────

# DATABASE_URL is the primary connection string from Aiven PostgreSQL
DATABASE_URL = os.environ.get("DATABASE_URL")

# ─── CONNECTION ──────────────────────────────────────────────────────────────

def get_db_conn():
    """Returns a PostgreSQL connection using the DATABASE_URL."""
    if not DATABASE_URL:
        logging.error("DATABASE_URL not found in environment variables.")
        raise RuntimeError("DATABASE_URL is required for PostgreSQL connection.")
    
    try:
        # Connect with SSL required as per Aiven defaults
        # psycopg (v3) uses 'sslmode' instead of 'sslmode' in the connection string or as a keyword arg
        conn = psycopg.connect(DATABASE_URL, sslmode="require")
        # Enable autocommit to match previous behavior
        conn.autocommit = True
        return conn
    except Exception as e:
        logging.error(f"Error connecting to PostgreSQL: {e}")
        raise

def get_connection():
    """Alias for get_db_conn() as requested."""
    return get_db_conn()

def execute_query(cursor, query: str, params: tuple = ()):
    """Executes a query using the provided cursor and parameters."""
    cursor.execute(query, params)

def fetch_one(cursor) -> Optional[Dict[str, Any]]:
    """Fetches a single row and returns it as a dictionary."""
    # If the cursor uses dict_row, it returns a dict already
    row = cursor.fetchone()
    if not row:
        return None
    return dict(row)

def fetch_all(cursor) -> List[Dict[str, Any]]:
    """Fetches all rows and returns them as a list of dictionaries."""
    rows = cursor.fetchall()
    return [dict(r) for r in rows]

# ─── HELPERS ─────────────────────────────────────────────────────────────────

def _hash_pw(plain: str) -> str:
    """Bcrypt hash for password storage."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def _verify_pw(plain: str, hashed: str) -> bool:
    """Check a plaintext password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False

def process_row(d: Optional[Dict]) -> Dict:
    """Formats date/time fields in a dictionary to ISO format for JSON responses."""
    if not d:
        return {}
    for key in ("Created_Date", "Assigned_At", "Resolved_At",
                "Due_Date", "Requested_At", "Timestamp"):
        if key in d and d[key] and isinstance(d[key], (datetime, str)):
            if isinstance(d[key], datetime):
                d[key] = d[key].isoformat()
            else:
                try:
                    d[key] = datetime.strptime(
                        d[key].split(".")[0], "%Y-%m-%d %H:%M:%S"
                    ).isoformat()
                except Exception:
                    pass
    return d

# ─── SCHEMA INIT ─────────────────────────────────────────────────────────────

def _init_tables(cursor, prefix=""):
    """Creates the PostgreSQL tables if they do not exist."""
    p = prefix
    # Customers Table
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {p}Customers (
            Customer_ID SERIAL PRIMARY KEY,
            Name VARCHAR(255),
            Email_ID VARCHAR(255) UNIQUE
        )
    """)
    
    # Support_Agents Table
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {p}Support_Agents (
            Agent_ID SERIAL PRIMARY KEY,
            Name VARCHAR(255),
            Email_ID VARCHAR(255) UNIQUE,
            Role VARCHAR(50),
            Password VARCHAR(255) NULL,
            Is_Temp_Password BOOLEAN DEFAULT FALSE,
            Auth_Provider VARCHAR(50) DEFAULT 'Local'
        )
    """)
    
    # Tickets Table
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {p}Tickets (
            Ticket_ID SERIAL PRIMARY KEY,
            Customer_ID INTEGER,
            Agent_ID INTEGER NULL,
            Subject VARCHAR(255),
            Description TEXT,
            Status VARCHAR(50) DEFAULT 'Open',
            Priority VARCHAR(50),
            FollowUpCount INTEGER DEFAULT 0,
            Rating INTEGER NULL,
            Created_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            Assigned_At TIMESTAMP NULL,
            Resolved_At TIMESTAMP NULL,
            Due_Date TIMESTAMP NULL
        )
    """)
    
    # Ticket_Conversations Table
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {p}Ticket_Conversations (
            Message_ID SERIAL PRIMARY KEY,
            Ticket_ID INTEGER,
            Sender_Role VARCHAR(50),
            Message_Text TEXT,
            Timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Password_Change_Requests Table
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {p}Password_Change_Requests (
            Request_ID SERIAL PRIMARY KEY,
            Agent_ID INTEGER,
            Status VARCHAR(50) DEFAULT 'Pending',
            Requested_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Ticket_Transfer_Requests Table
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {p}Ticket_Transfer_Requests (
            Request_ID SERIAL PRIMARY KEY,
            Ticket_ID INTEGER NOT NULL,
            From_Agent_ID INTEGER NOT NULL,
            To_Agent_ID INTEGER NOT NULL,
            Status VARCHAR(50) DEFAULT 'Pending',
            Requested_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            Processed_At TIMESTAMP NULL,
            Processed_By INTEGER NULL
        )
    """)

def init_db():
    """Initializes the PostgreSQL database schema and seeds default data."""
    conn = get_db_conn()
    # Use dict_row to ensure rows are returned as dictionaries
    cursor = conn.cursor(row_factory=dict_row)
    
    try:
        # 1. Create Production Tables
        _init_tables(cursor)
        logging.info("PostgreSQL production tables checked/created.")

        # 2. Seed default administrators/agents
        agents = [
            ("Admin",    "admin@support.com",    "Administrator", _hash_pw("admin1234")),
            ("Ganesh",   "ganesh@support.com",   "Agent",         _hash_pw("ganesh123")),
            ("Rudransh", "rudransh@support.com", "Agent",         _hash_pw("rudransh123")),
        ]
        for name, email, role, pw in agents:
            cursor.execute("SELECT Agent_ID FROM Support_Agents WHERE Email_ID = %s", (email,))
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO Support_Agents (Name, Email_ID, Role, Password) VALUES (%s, %s, %s, %s)",
                    (name, email, role, pw)
                )
        
        # 3. Demo Mode: create + seed demo tables in the same PostgreSQL DB
        if os.environ.get("DEMO_MODE") == "true":
            _init_tables(cursor, prefix="Demo_")
            logging.info("PostgreSQL Demo_ tables checked/created.")
        
        logging.info("Database initialization complete.")
        
    except Exception as e:
        logging.error(f"Database initialization error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

# These variables are kept for compatibility with main.py imports
IS_MYSQL = False
PH = "%s"
