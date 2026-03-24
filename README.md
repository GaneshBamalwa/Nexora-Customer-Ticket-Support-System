# Nexora Integrated - Customer Support Platform

> Secure full-stack customer support platform combining the **Nexora Enterprise** React frontend with the **Customer Support Portal** FastAPI backend.

## Architecture

```
nexora-integrated/
├── client/          # React + Vite + TailwindCSS frontend
│   └── src/
│       ├── api.ts           # Centralised API client with JWT
│       ├── pages/           # Home, StaffLogin, AgentDashboard, AdminDashboard, Conversation
│       ├── components/      # UI components, CustomCursor, ImmersiveBackground
│       └── ...
├── server/          # FastAPI backend
│   ├── main.py              # API routes with rate limiting & security
│   ├── db.py                # Database layer (SQLite/MySQL)
│   ├── auth.py              # JWT authentication & IDOR prevention
│   ├── .env                 # Environment configuration
│   └── requirements.txt
├── UNMAPPED_FRONTEND_FEATURES.md
├── UNMAPPED_BACKEND_FEATURES.md
└── README.md
```

## Quick Start

### 1. Backend

```bash
cd server
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
python main.py                 # Starts on http://localhost:5000
```

### 2. Frontend

```bash
cd client
npm install
npm run dev                    # Starts on http://localhost:3001
```

### 3. Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@support.com | admin1234 |
| Agent | ganesh@support.com | ganesh123 |
| Agent | rudransh@support.com | rudransh123 |

## Security Features

- **Bcrypt password hashing** (replaces SHA-256)
- **JWT Bearer authentication** with 8-hour expiry
- **IDOR prevention** – every endpoint verifies data ownership
- **Rate limiting** – Login: 5/min, Tickets: 10/min, API: 60/min
- **Security headers** – X-Frame-Options, CSP, HSTS, etc.
- **HTTPS enforcement** (configurable via env)
- **CORS locked** to frontend origin only
- **Input validation** – Pydantic models with regex, length, and type constraints
- **Parameterised SQL queries** – zero string interpolation
- **Secrets in .env** – never hardcoded
- **Password strength requirements** – min 8 chars, uppercase, lowercase, digit
