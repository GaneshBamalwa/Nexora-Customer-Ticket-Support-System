# Nexora — Implemented Features & Core Capabilities

This document tracks the current features and technical implementations of the Nexora Support Portal.

---

## 🚀 1. AI-Driven Intelligence
Nexora leverages state-of-the-art LLMs to transform support workflows from manual to augmented operations.

*   **Nexora AI (Project Brain):** A specialized chatbot integrated into the About page that understands the entire Nexora architecture, team, and SLAs. Powered by Google Gemini 2.0 via OpenRouter.
*   **AI Agent Suggestions:** A real-time drafting tool for support agents. It analyzes ticket context and conversation history to formulate professional, empathetic responses with a single click.
*   **Intelligent Triage:** AI-ready backend conduits for automated ticket categorization and priority assessment (extensible via `/api/ai/suggest`).

---

## 🏗️ 2. Core Platform Architecture
A robust, high-performance tech stack designed for both agility and enterprise-grade security.

*   **Hybrid Database Strategy:** Zero-config switching between **SQLite** (for local development) and **MySQL/MariaDB** (for production) using a centralized abstraction layer in `server/db.py`.
*   **Isolated Demo Environments:** A unique feature that spawns **per-session isolated databases**. Recruiters and demo users get their own transient sandbox with seeded mock data, ensuring a "clean slate" without touching production data.
*   **Stateless JWT Security:** Secure, claim-based authentication using JSON Web Tokens with 8-hour expiry and role-based access control (RBAC).
*   **Async Background Workers:** A custom `asyncio` engine in the FastAPI process that automatically monitors stale tickets and auto-assigns them to the least-loaded agents every 5 minutes.

---

## 🛡️ 3. Security & Safety Infrastructure
Security is baked into the foundation, not bolted on as an afterthought.

*   **Bcrypt Password Hardening:** Replaces legacy hashing with industry-standard salted Bcrypt protocols.
*   **IDOR Prevention:** Strict ownership verification (`require_owner_or_admin`) on every sensitive API endpoint.
*   **Rate Limiting:** Granular protection against brute-force attacks via `slowapi` (Login: 5/min, Tickets: 10/min, API: 60/min).
*   **Bulletproof SQL:** 100% parameterization of raw SQL queries, completely eliminating SQL Injection vulnerabilities.
*   **Security Headers:** Automatic injection of `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and CSP-ready headers.

---

## 📊 4. Operational Intel & Analytics
Transforming raw data into actionable insights for administrators.

*   **Performance Monitoring:** Real-time metrics for every agent, including resolution counts, average ratings, and average resolution time (ART).
*   **Visual Analytics:** Interactive dashboards powered by **Recharts**, featuring:
    *   **Resolution Trends:** Daily throughput line charts.
    *   **Priority Mix:** Distribution of High/Medium/Low workload via pie charts.
*   **Data Export:** One-click CSV and PDF generation for agent performance and system audits.
*   **Approval Queues:** Centralized dashboard for managing password change requests and ticket transfer requests between nodes.

---

## 🛠️ 5. Administrative Tooling
Powerful internal tools that provide absolute control over the platform.

*   **Integrated SQL Console:** A CodeMirror-powered "Playground" for administrators to run raw SQL queries directly against the connected DB with built-in safety guards.
*   **Interactive ER Diagram:** Visual mapping of the database schema synchronized with the SQL Console for easier data exploration.
*   **Team Enrollment:** Dynamic provisioning of new agents and administrators with "Temporary Password" workflows requiring immediate reset.

---

## 💎 6. Premium User Experience (UX)
A "wow factor" design system that sets Nexora apart from generic corporate tools.

*   **Immersive 3D Visuals:** A Three.js interactive background on the About page featuring a rotating orbital mesh.
*   **Neon-Gothic Design:** A high-fidelity dark theme with glassmorphism, vibrant primary accents (#00E5FF), and neon-glow effects.
*   **Micro-Interactions:** Smooth Framer Motion transitions, custom cursor followers, and "Materialize" animation sequences for loading states.
*   **Easter Eggs:** Interactive brand moments, such as the **Canvas Confetti** shower triggered by clicking the brand logo.

---

## 🌗 7. Multi-Provider Connectivity
Seamless integration with external identity providers.

*   **Google OAuth 2.0:** One-tap login for agents using Google Workspace accounts.
*   **Microsoft Azure AD:** Professional OAuth integration for enterprise tenants.
*   **Manual Fallback:** Secure local login for accounts not linked to external providers.

---

## ⚙️ 8. Tech Stack Summary
- **Frontend:** React 19, Vite 8, Tailwind CSS 4, Wouter, Framer Motion, Three.js, Lucide Icons, Shadcn/UI.
- **Backend:** FastAPI (Python 3.10+), Pydantic v2, Authlib, OpenAI/OpenRouter.
- **Database:** Raw SQL (MySQL/SQLite) with zero-ORM strategy for max performance.
