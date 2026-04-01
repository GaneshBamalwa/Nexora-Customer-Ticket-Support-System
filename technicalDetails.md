# Nexora — Technical Details & Architecture

This document provides a comprehensive technical overview of the Nexora Support Portal, designed to familiarize AI models or new developers with the entire project.

---

## 1. Project Overview

Nexora is a futuristic, AI-powered customer support platform. It integrates automated ticket triage, real-time analytics, and a high-fidelity immersive interface to transform traditional helpdesk systems.

- client/ — React 19 frontend (Vite)
- server/ — FastAPI backend (Python)
- GitHub Repo: GaneshBamalwa/customer_portal_integrated

---

## 2. Technology Stack

### Frontend (client/)
- Framework: React 19 with hooks (useState, useEffect, useRef)
- Build Tool: Vite 8.x with HMR
- Routing: wouter (lightweight, no React Router dependency)
- Styling: Tailwind CSS 4.0 with utility-first classes and CSS variables
- Animations: Framer Motion for micro-interactions and page transitions
- UI Components: Shadcn/UI — Radix-based accessible primitives (Dialog, Select, Tabs, Dropdown, etc.)
- 3D Graphics: Three.js + @react-three/fiber for immersive landing backgrounds
- Icons: lucide-react
- Charts: Chart.js + react-chartjs-2 and Recharts for analytics dashboards
- Forms: react-hook-form + zod for schema validation
- HTTP Client: axios, centralized in client/src/api/
- Markdown: react-markdown for rendering AI chat responses

### Backend (server/)
- Framework: FastAPI (Python 3.10+), async-capable ASGI server
- Input Validation: Pydantic v2 models on all endpoints
- Auth: JWT (JSON Web Tokens) — stateless, signed with HS256
- Password Hashing: bcrypt (NOT sha256)
- Rate Limiting: slowapi library (plugs into FastAPI)
- Rate Limits: Login=5/min, Ticket creation=10/min, General API=60/min
- CORS: Configured via CORSMiddleware
- Security Headers: Custom HTTP middleware injects X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- AI: OpenAI API for ticket triage, agent response suggestions, and the About page chatbot (Nexora AI)

---

## 3. Database Architecture

Nexora is ORM-less — uses raw SQL with parameterized queries for maximum performance and security.

### Hybrid Database Strategy
- Development: SQLite, file at server/support_portal.db
- Production: MySQL/MariaDB, credentials via environment variables
- Abstraction: server/db.py uses a PH constant (placeholder): %s for MySQL, ? for SQLite

### Environment Variables for MySQL (in server/.env)
- MYSQLHOST, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE, MYSQLPORT
- If MYSQLHOST is absent, system falls back to SQLite automatically

### Schema — 5 Core Tables

#### Customers
| Column      | Type         | Notes              |
|-------------|------------- |--------------------|
| Customer_ID | INT (PK)     | Auto-increment     |
| Name        | VARCHAR      | Derived from email |
| Email_ID    | VARCHAR (UQ) | Used for lookups   |

#### Support_Agents
| Column           | Type     | Notes                      |
|------------------|----------|----------------------------|
| Agent_ID         | INT (PK) | Auto-increment             |
| Name             | VARCHAR  |                            |
| Email_ID         | VARCHAR  | Unique                     |
| Role             | VARCHAR  | 'Agent' or 'Administrator' |
| Password         | VARCHAR  | Bcrypt hash                |
| Is_Temp_Password | BOOLEAN  | Forces setup on next login |

#### Tickets
| Column       | Type      | Notes                              |
|--------------|-----------|------------------------------------|
| Ticket_ID    | INT (PK)  | Auto-increment                     |
| Customer_ID  | INT (FK)  | -> Customers                       |
| Agent_ID     | INT (FK)  | -> Support_Agents, nullable        |
| Subject      | VARCHAR   | Max 255 chars                      |
| Description  | TEXT      | Max 5000 chars                     |
| Status       | VARCHAR   | 'Open', 'Pending', or 'Resolved'   |
| Priority     | VARCHAR   | 'Low', 'Medium', or 'High'         |
| Rating       | INT       | Customer satisfaction score (1-5)  |
| FollowUpCount| INT       | How many times customer followed up|
| Created_Date | TIMESTAMP |                                    |
| Assigned_At  | TIMESTAMP |                                    |
| Resolved_At  | TIMESTAMP |                                    |
| Due_Date     | TIMESTAMP | Set on assignment based on Priority|

#### Ticket_Conversations
| Column      | Type      | Notes                   |
|-------------|-----------|-------------------------|
| Message_ID  | INT (PK)  | Auto-increment          |
| Ticket_ID   | INT (FK)  | -> Tickets              |
| Sender_Role | VARCHAR   | 'Customer' or 'Agent'   |
| Message_Text| TEXT      | Max 5000 chars          |
| Timestamp   | TIMESTAMP |                         |

#### Password_Change_Requests
| Column       | Type      | Notes                       |
|--------------|-----------|-----------------------------|
| Request_ID   | INT (PK)  | Auto-increment              |
| Agent_ID     | INT (FK)  | -> Support_Agents           |
| Status       | VARCHAR   | 'Pending' or 'Approved'     |
| Requested_At | TIMESTAMP |                             |

---

## 4. API Endpoints

### Public (No Auth Required)
- POST   /api/tickets                          — Raise a new support ticket
- POST   /api/tickets/search                   — Search ticket history by customer email
- GET    /api/tickets/{id}/conversation        — View thread (requires ?email= for guests)
- POST   /api/tickets/{id}/conversation        — Post message (requires ?email= for guests)
- GET    /api/tickets/{id}/rate/{rating}       — Submit satisfaction rating (1-5)
- GET    /api/tickets/{id}/follow-up           — Increment follow-up count, reopen ticket
- GET    /api/public/stats                     — Live platform stats for About page
- GET    /api/health                           — Server health check

### Auth
- POST /api/auth/login    — Agent login, returns JWT + user object
- GET  /api/auth/me       — Returns current user identity from JWT

### Agent (JWT Required)
- GET  /api/dashboard                     — Tickets scoped to agent (or all for admin)
- POST /api/tickets/{id}/resolve          — Mark a ticket as Resolved

### Admin (Administrator Role Required)
- GET    /api/admin/report                — Full analytics: stats, agent performance, priority breakdown
- POST   /api/admin/agents                — Add new agent (with optional temp password)
- DELETE /api/admin/agents/{id}           — Remove an agent
- POST   /api/admin/tickets/{id}/assign   — Assign/reassign a ticket

### AI
- POST /api/ai/query    — Query the Nexora AI chatbot (used on About page)

---

## 5. Key Workflows

### Ticket Lifecycle
1. Customer submits form -> POST /api/tickets with email, subject, description, priority
2. System checks if customer exists by email; creates new Customers record if not
3. Ticket inserted with Status='Open', Agent_ID=NULL
4. Background task (runs every 5 min) auto-assigns tickets >24 hours old to least-loaded agent
5. Agent converses with customer through Ticket_Conversations
6. Agent calls POST /api/tickets/{id}/resolve
7. Customer can rate (GET /api/tickets/{id}/rate/{rating})

### SLA / Due Dates (set at assignment time)
- High Priority   -> Due in 24 hours
- Medium Priority -> Due in 48 hours
- Low Priority    -> Due in 72 hours

### Authentication Flow
1. Agent POSTs {email, password} to /api/auth/login
2. Server runs bcrypt.checkpw(input_pw, stored_hash)
3. On success: create_token(user) returns a signed JWT
4. Frontend stores JWT, attaches as Authorization: Bearer {token} on all requests
5. If Is_Temp_Password=True: frontend redirects to /set-password

### AI Chatbot (About Page)
1. User types a question in the chat UI
2. Frontend calls POST /api/ai/query with {question: "..."}
3. Server calls OpenAI Chat Completions API with a system prompt containing full Nexora context
4. AI response is returned and rendered as formatted Markdown

---

## 6. Security Architecture
- SQL Injection: Prevented by 100% parameterized queries via execute_query(cursor, sql, params)
- IDOR: Every agent data-access endpoint verifies Agent_ID matches JWT, unless role=Administrator
- Brute Force: slowapi rate limits on login and ticket creation
- Password Policy: Min 8 chars, must include uppercase, lowercase, digit
- No Secret Leakage: Password hashes never returned in any API response
- DB Connection Safety: All connections wrapped in try/finally to ensure conn.close()
- HTTPS enforcement: Configurable via ENFORCE_HTTPS env variable (optional in prod)

---

## 7. Frontend Page Structure

| Route              | Description                                                      |
|--------------------|------------------------------------------------------------------|
| /                  | Public home — ticket submission form + ticket history tracker    |
| /about             | Immersive marketing page: team, live stats, AI chatbot           |
| /staff-login       | Agent/Admin login portal                                         |
| /dashboard         | Agent ticket management dashboard with conversation view         |
| /admin             | Admin analytics panel + agent management                         |
| /conversation/:id  | Full ticket conversation thread (agent-side)                     |
| /set-password      | Forced password setup for temp-password accounts                 |

---

## 8. Notable Features
- Secret Confetti Easter Egg: Clicking "NEXORA" in the footer triggers a 5-second canvas-confetti shower
- Immersive About Page: Parallax hero, animated orbit rings, Database Core pipeline visualization, AI chatbot
- Auto-assign Background Task: asyncio loop that runs every 5 minutes in the server process to assign stale tickets
- Admin SQL Playground: CodeMirror-powered SQL editor (Okaidia theme) for running live queries
- Ticket Follow-up: Customers can reopen resolved tickets with a single click

---

## 9. Team
- Ganesh Bamalwa  — Co-Developer (github.com/GaneshBamalwa | linkedin.com/in/ganeshbamalwa)
- Rudransh Kadiveti — Co-Developer, Backend & SQL (github.com/RudranshKadiveti)

---

## 10. Running Locally

### Frontend
cd client
npm install
npm run dev
# -> http://localhost:5173

### Backend
cd server
pip install -r requirements.txt
python main.py
# -> http://localhost:8000
# API Docs -> http://localhost:8000/api/docs

### Required server/.env Variables
OPENAI_API_KEY=your_openai_key
JWT_SECRET=your_jwt_secret

# Leave these blank to use SQLite:
MYSQLHOST=
MYSQLUSER=
MYSQLPASSWORD=
MYSQLDATABASE=
MYSQLPORT=
