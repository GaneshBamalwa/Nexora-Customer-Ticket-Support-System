<div align="center">

# 🌌 NEXORA
### The Future of AI-Driven Customer Support
**Secure. Immersive. Intelligent.**

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![MySQL](https://img.shields.io/badge/mysql-%2300f.svg?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen.svg?style=flat-square)](#)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blueviolet.svg?style=flat-square)](#)
[![Stars](https://img.shields.io/github/stars/GaneshBamalwa/customer_portal_integrated?style=flat-square&color=cyan)](https://github.com/GaneshBamalwa/customer_portal_integrated/stargazers)


</div>

---

## ✨ Project Overview

**Nexora** is a production-grade, AI-powered customer support ecosystem designed to bridge the gap between complex enterprise workflows and seamless user experiences. By combining a **high-fidelity, immersive React frontend** with a **hardened FastAPI backend**, Nexora delivers a support platform that isn't just functional—it's futuristic.

### 🎯 Why Nexora?
- **AI-First Workflow**: Automated triage and intelligent response suggestions.
- **Immersive UX**: 3D particle systems and motion-rich interfaces that WOW users.
- **Battle-Hardened Security**: Multi-layered defense including JWT, Bcrypt, and IDOR protection.
- **Operational Excellence**: Real-time analytics and background automation.

---

## 🚀 Features

### 🧠 AI Capabilities
- **Nexora AI Chatbot**: Interactive, context-aware support bot powered by OpenAI.
- **Smart Response Suggestions**: Real-time AI drafting for support agents to accelerate resolution.
- **Automated Triage**: Background tasks that intelligently route and assign tickets based on priority and load.

### 🛡️ Security (Zero-Trust Approach)
- **Hardened Auth**: JWT Bearer tokens with 8-hour expiry and Bcrypt password hashing.
- **IDOR Protection**: Strict ownership validation on every sensitive API endpoint.
- **Threat Mitigation**: Built-in rate limiting (`slowapi`) and 100% parameterized SQL queries.
- **Security Headers**: Custom middleware for `X-Frame-Options`, `CSP`, and `HSTS`.

### 📊 Admin & Analytics
- **Live Command Center**: Real-time dashboard for administrators to monitor global performance.
- **SLA Tracking**: Automated due-date calculation (24h/48h/72h) based on ticket priority.
- **Performance Metrics**: Detailed agent performance reports and customer satisfaction (CSAT) tracking.

### 💎 UX & Design
- **3D Immersive Backgrounds**: Interactive Three.js particle systems for an premium feel.
- **Micro-Interactions**: Fluid animations powered by Framer Motion.
- **Glassmorphic UI**: Modern, sleek design language built with Tailwind CSS 4.0.

---

## 🏗️ System Architecture

```mermaid
graph TD
    A[User / Customer] -->|HTTPS| B(React Frontend)
    C[Support Agent] -->|JWT Auth| B
    B -->|API Requests| D{FastAPI Gateway}
    D -->|Triage Task| E[Background Worker]
    D -->|Query/Update| F[(MySQL / SQLite)]
    D -->|Contextual Query| G[OpenAI GPT-4o]
    G -->|Response Suggestion| D
```

---

## 💾 Database Schema

```mermaid
erDiagram
    CUSTOMERS ||--o{ TICKETS : raises
    SUPPORT_AGENTS ||--o{ TICKETS : manages
    TICKETS ||--o{ TICKET_CONVERSATIONS : contains
    SUPPORT_AGENTS ||--o{ PASSWORD_CHANGE_REQUESTS : requests
    TICKETS ||--o{ TICKET_TRANSFER_REQUESTS : initiates
```

---

## 🏗️ Folder Structure

> **Note:** Nexora uses an ORM-less database approach to maximize performance and ensure complete control over SQL execution.

---

## ⚙️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS 4.0, Framer Motion, Three.js |
| **Backend** | FastAPI, Python 3.10+, SlowAPI (Rate Limiting) |
| **Database** | MySQL (Production), SQLite (Development), raw SQL |
| **Authentication** | JWT, Bcrypt Hashing |
| **AI Integration** | OpenAI GPT-4o / llama-3.3-70b-versatile |

---


---

## 🛠️ Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- MySQL (Optional, defaults to SQLite)

### 1. Setup Backend
```bash
cd server
pip install -r requirements.txt
cp .env.example .env  # Add your OpenAI & JWT secrets
python main.py
```

### 2. Setup Frontend
```bash
cd client
npm install
npm run dev
```

---

## 👨‍💻 Contributors
- **Ganesh Bamalwa** - [GitHub](https://github.com/GaneshBamalwa) | [LinkedIn](https://linkedin.com/in/ganeshbamalwa)
- **Rudransh Kadiveti** - [GitHub](https://github.com/RudranshKadiveti)

---

