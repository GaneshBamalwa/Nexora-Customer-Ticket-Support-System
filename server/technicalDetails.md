# Nexora — Technical Details & Architecture

This document provides a comprehensive technical overview of the Nexora Support Portal, designed to familiarize AI models or new developers with the project's architecture, stack, and core logic.

---

## 1. Project Overview
Nexora is a futuristic, AI-powered customer support platform. It integrates advanced automation, real-time analytics, and a high-fidelity immersive interface to transform traditional ticketing systems.

**Key Repositories:**
- `client/`: React-based frontend (Vite).
- `server/`: FastAPI-based backend (Python).

---

## 2. Technology Stack

### A. Frontend (client/)
- **Framework:** React 19 (utilizing hooks like `useState`, `useEffect`, `useRef`).
- **Build Tool:** Vite (configured for fast HMR).
- **Routing:** `wouter` (lightweight alternative to React Router).
- **Styling:** 
  - **Tailwind CSS 4.0:** Using utility-first styling and CSS variables.
  - **Framer Motion:** For advanced micro-interactions and smooth layout transitions.
  - **Shadcn/UI:** Pre-built Radix-based components (Dialogs, Selects, Tabs, etc.).
- **Immersive Elements:** 
  - **Three.js / @react-three/fiber:** Used for 3D backgrounds and particle systems.
- **Icons:** `lucide-react`.
- **Data Visualization:** `Chart.js` and `Recharts` for operational dashboards.
- **Form Management:** `react-hook-form` + `zod` for schema-based validation.
- **API Interaction:** `axios` with a centralized API layer in `client/src/api`.

### B. Backend (server/)
- **Framework:** FastAPI (Python 3.10+).
- **Validation:** Pydantic models for all request/response schemas.
- **Authentication:** 
  - **JWT (JSON Web Tokens):** For stateless session management.
  - **Bcrypt:** For secure password hashing (No SHA-256).
- **Security:**
  - **SlowAPI:** Implementation of rate-limiting on sensitive endpoints (Login, Ticket Creation).
  - **CORS:** Locked to specific origins.
  - **Security Headers:** Custom middleware to inject `X-Frame-Options`, `Content-Security-Policy`, etc.
- **AI Integration:** OpenAI API (`gpt-4o` or similar specialized models) used for:
  - Automated ticket triaging.
  - AI-assisted agent responses.
  - Interactive "Nexora AI" chatbot on the About page.

---

## 3. Database Architecture

Nexora uses an **ORM-less approach** to prioritize performance and full control over SQL execution.

### Hybrid Strategy
- **SQLite (Development):** Stored in `server/support_portal.db`.
- **MySQL (Production):** Connects via environment variables (`MYSQLHOST`, `MYSQLUSER`, etc.).
- **Abstraction Layer:** `server/db.py` handles connection logic and utilizes a `PH` (Placeholder) constant (`%s` for MySQL, `?` for SQLite) to maintain cross-database compatibility.

### Core Schema
1.  **`Customers`**: `Customer_ID`, `Name`, `Email_ID` (Unique).
2.  **`Support_Agents`**: `Agent_ID`, `Name`, `Email_ID`, `Password` (Hash), `Role` (Agent/Administrator).
3.  **`Tickets`**: `Ticket_ID`, `Customer_ID`, `Agent_ID`, `Subject`, `Description`, `Status` (Open/Pending/Resolved), `Priority`, `Rating`, `FollowUpCount`.
4.  **`Ticket_Conversations`**: `Message_ID`, `Ticket_ID`, `Sender_Role`, `Message_Text`, `Timestamp`.
5.  **`Password_Change_Requests`**: For administrative password management.

---

## 4. Key Workflows

### A. Ticket Lifecycle
1.  **Ingestion:** Customer submits issue (via `POST /api/tickets`).
2.  **Triage:** Automated auto-assignment logic (`background_auto_assign` in `main.py`) matches tickets to available agents based on workload.
3.  **Conversation:** Real-time message exchange between customers (via email identification) and agents (via authenticated dashboard).
4.  **Resolution:** Agent marks ticket as resolved; customer is prompted for a Satisfaction Rating (1-5).

### B. Agent Authentication
- Staff login generates a JWT stored in local storage.
- Admin dashboard allows creating new agents and viewing global performance reports.
- Agent dashboard provides a filtered view of assigned vs. unassigned tickets.

---

## 5. Security & Best Practices
- **Parameterized Queries:** Every database call uses placeholders to prevent SQL Injection.
- **IDOR Prevention:** Backend checks `Agent_ID` on every sensitive data access to ensure agents only see their own tickets (unless they hold the Administrator role).
- **Sensitive Data Masking:** Passwords and secrets are never returned in JSON responses.
- **Environment Variables:** All secrets (OpenAI Key, JWT Secret, DB Credentials) are managed via `.env`.

---

## 6. Directory Structure
- `/client/src/components/`: Reusable UI elements and layouts.
- `/client/src/pages/`: Main application views (Dashboard, About, Ticket Tracker).
- `/client/src/api/`: Centralized API calls and Axios configuration.
- `/server/main.py`: Entry point, API routes, and background tasks.
- `/server/db.py`: Database connection pool and utility functions.
- `/server/auth.py`: JWT generation and authorization decorators.
