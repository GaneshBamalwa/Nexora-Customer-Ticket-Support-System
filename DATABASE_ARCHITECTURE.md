# Nexora Database Architecture & Integration Guide

This document provides a comprehensive overview of the Nexora Support Portal's database layer, its connection mechanisms, and how it interactively serves the frontend application.

---

## 1. Database Overview

Nexora is designed with a **hybrid database strategy**, supporting two distinct environments:
- **Development (SQLite):** Used for local development and testing. It stores data in a local file (`support_portal.db`).
- **Production (MySQL/MariaDB):** Used for deployment, providing high availability and performance.

### Core Technology Stack
- **ORM-less approach:** Uses raw SQL with parameterized queries for maximum performance and security.
- **Encryption:** `bcrypt` is used for hashing passwords before storage.
- **Drivers:** `mysql-connector-python` for MySQL and the built-in `sqlite3` for Python.

---

## 2. Database Schema (Entities & Relationships)

The system consists of five primary tables that handle everything from user authentication to ticket lifecycle management.

### A. `Customers`
Stores information about individuals who raise tickets.
| Column | Type | Description |
| :--- | :--- | :--- |
| `Customer_ID` | INT (PK) | Unique identifier for the customer. |
| `Name` | VARCHAR | Customer's full name (derived from email prefix if new). |
| `Email_ID` | VARCHAR (U) | Unique email address used for history lookups. |

### B. `Support_Agents`
Stores staff credentials and roles.
| Column | Type | Description |
| :--- | :--- | :--- |
| `Agent_ID` | INT (PK) | Unique identifier for the agent. |
| `Name` | VARCHAR | Agent's display name. |
| `Role` | VARCHAR | Either `Administrator` or `Agent`. |
| `Password` | VARCHAR | Bcrypt-hashed password string. |
| `Is_Temp_Password`| BOOLEAN | Flag to force password change on next login. |

### C. `Tickets`
The central table for all support requests.
| Column | Type | Description |
| :--- | :--- | :--- |
| `Ticket_ID` | INT (PK) | Unique ticket number. |
| `Customer_ID` | INT (FK) | Reference to the requester. |
| `Agent_ID` | INT (FK) | Reference to the assigned agent (can be NULL). |
| `Subject` | VARCHAR | Summary of the issue. |
| `Description` | TEXT | Detailed issue description. |
| `Status` | VARCHAR | `Open`, `Pending`, or `Resolved`. |
| `Priority` | VARCHAR | `Low`, `Medium`, or `High`. |
| `Rating` | INT | Customer satisfaction score (1-5). |
| `Created_Date` | TIMESTAMP | Creation time. |

### D. `Ticket_Conversations`
Stores the message thread for each ticket.
| Column | Type | Description |
| :--- | :--- | :--- |
| `Message_ID` | INT (PK) | Unique message identifier. |
| `Ticket_ID` | INT (FK) | Links message to a specific ticket. |
| `Sender_Role` | VARCHAR | `Customer` or `Agent`. |
| `Message_Text` | TEXT | The actual message content. |

### E. `Password_Change_Requests`
Tracks administrative tasks for agent account security.

---

## 3. Connection Architecture

The connection logic is abstracted in `server/db.py`.

### How it Connects:
1. **Environment Detection:** The server checks for the presence of values like `MYSQLHOST` in `.env`.
2. **Dynamic Connector:** 
   - If `MYSQLHOST` exists, it initiates a connection via `mysql.connector`.
   - Otherwise, it defaults to a local `sqlite3` connection (`support_portal.db`).
3. **Parameter Abstraction:** To handle the different syntax between MySQL (`%s`) and SQLite (`?`), the system uses a `PH` (Placeholder) constant.

```python
# db.py handles the abstraction
def get_db_conn():
    if IS_MYSQL:
        import mysql.connector
        return mysql.connector.connect(...)
    return sqlite3.connect(DB_PATH)
```

---

## 4. Query Lifecycle: From Frontend to Database

Every operation follows a secure, multi-step pipeline.

### Step 1: Frontend Request
The React frontend sends an HTTP request (e.g., `POST /api/tickets`) using JSON data.

### Step 2: Backend Validation (FastAPI + Pydantic)
The FastAPI server validates the input using Pydantic models to ensure types are correct and data isn't malicious (e.g., checking email format, min/max lengths).

### Step 3: Database Logic
The server opens a database connection and executes a parameterized query.
> [!IMPORTANT]
> **No SQL Injection:** Queries never use string interpolation. They use the `execute_query(cursor, query, params)` helper which keeps data and logic separate.

### Step 4: Data Processing
The `process_row` helper in `db.py` converts database formats (like SQL timestamps) into standard ISO strings that the frontend can easily parse.

### Step 5: Response
The server sends a JSON response back to the frontend, which updates the UI (e.g., showing a "Ticket Raised" success message).

---

## 5. Key Operations Workflow

### Ticket Creation
1. **Check Customer:** Search `Customers` by email.
2. **Create if New:** If not found, `INSERT` a new customer record.
3. **Insert Ticket:** Add record to `Tickets` with the `Customer_ID`.
4. **Result:** Return the `Ticket_ID` to the user for tracking.

### Ticket Searching
1. **Fetch Customer:** Identify `Customer_ID` via email.
2. **Join/Filter:** `SELECT * FROM Tickets WHERE Customer_ID = ?`.
3. **Sort:** Order by `Ticket_ID DESC` so the newest tickets appear first.

### Authentication Flow
1. **Fetch Hash:** `SELECT Password FROM Support_Agents WHERE Email_ID = ?`.
2. **Verify:** Use `bcrypt.checkpw()` to compare the login password with the stored hash.
3. **Authorize:** If valid, generate a **JWT (JSON Web Token)** that allows the agent to access protected database records.

---

## 6. Security Features
- **IDOR Protection:** When an agent requests ticket details, the query includes checks to ensure they can't peek at other agents' data unless they are an Administrator.
- **Rate Limiting:** Protects the database from brute-force login attempts or spam ticket creation using the `slowapi` library.
- **Connection Closure:** Connections are strictly handled in `try...finally` blocks to prevent database locks and memory leaks.
