# Unmapped Backend Features

> Backend logic from **customer-support-portal** that exists in the API but is **not yet surfaced** in the React frontend.

## Fully Mapped API Routes ✅

| Backend Route | Frontend Integration |
|--------------|---------------------|
| `POST /api/tickets` | Home → New Ticket form |
| `POST /api/tickets/search` | Home → Track Ticket |
| `GET /api/tickets/{id}/conversation` | Conversation page |
| `POST /api/tickets/{id}/conversation` | Conversation page → send message |
| `GET /api/tickets/{id}/rate/{rating}` | Home → star rating on resolved tickets |
| `GET /api/tickets/{id}/follow-up` | Home → Follow Up button |
| `POST /api/auth/login` | StaffLogin page |
| `GET /api/auth/me` | Used internally by API client |
| `GET /api/dashboard` | AgentDashboard / AdminDashboard |
| `POST /api/tickets/{id}/resolve` | AgentDashboard → Resolve button |
| `GET /api/admin/report` | AdminDashboard → Overview tab |
| `POST /api/admin/agents` | AdminDashboard → Add Team Member |
| `POST /api/admin/tickets/{id}/assign` | AdminDashboard → Assign tab |
| `POST /api/admin/pw-requests/{id}/{action}` | AdminDashboard → Approvals tab |
| `POST /api/password/set` | Backend ready, needs frontend page |
| `POST /api/password/request-change` | Backend ready, needs frontend page |
| `GET /api/password/status` | Backend ready, needs frontend page |
| `POST /api/ai/suggest` | Placeholder – returns stub message |
| `GET /api/health` | Health check – no UI needed |

## Backend Features Without Frontend

| # | Feature | API Route | Description |
|---|---------|-----------|-------------|
| 1 | **Set Password page** | `POST /api/password/set` | Backend validates password strength (8+ chars, uppercase, lowercase, digit) – needs dedicated React page |
| 2 | **Request Password Change** | `POST /api/password/request-change` | Agents can request admin approval to change password – needs UI trigger |
| 3 | **Password Status Check** | `GET /api/password/status` | Returns whether user has a password and if change is approved – used by set-password page |
| 4 | **AI Suggestions** | `POST /api/ai/suggest` | Stub endpoint – needs LLM integration and UI to display suggestions inline |

## Backend Security Features (Implemented, No UI Required)

| # | Security Feature | Implementation |
|---|-----------------|----------------|
| 1 | **Bcrypt password hashing** | Replaces SHA-256 from original; stored in `Support_Agents.Password` |
| 2 | **JWT Bearer authentication** | 8-hour tokens with agent_id, role, email in payload |
| 3 | **IDOR prevention** | Every data endpoint verifies ownership via `require_owner_or_admin()` |
| 4 | **Rate limiting** | Login: 5/min, Ticket creation: 10/min, General API: 60/min |
| 5 | **Input validation** | Pydantic models enforce email format, string length, enum values, password strength |
| 6 | **Security headers** | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy |
| 7 | **HTTPS enforcement** | Configurable via `ENFORCE_HTTPS=1` env var; adds HSTS header |
| 8 | **CORS locking** | Only `CORS_ORIGIN` env var is allowed (default: `http://localhost:3001`) |
| 9 | **Trusted hosts** | FastAPI `TrustedHostMiddleware` restricts to known hosts |
| 10 | **Parameterised queries** | All SQL uses `%s`/`?` placeholders – zero string interpolation |
| 11 | **Secrets in .env** | `SECRET_KEY`, `JWT_SECRET`, DB credentials loaded from environment |
| 12 | **No public DB access** | Database is accessed only through server-side parameterised queries |

## Original Backend Features Not Carried Over

| # | Feature | Reason |
|---|---------|--------|
| 1 | **Jinja2 HTML templates** | Replaced by React SPA frontend |
| 2 | **Session middleware** | Replaced by stateless JWT auth |
| 3 | **Flash messages** | Replaced by `sonner` toast notifications in React |
| 4 | **Flask backup file** | `app_flask_backup.py` – legacy, not needed |
