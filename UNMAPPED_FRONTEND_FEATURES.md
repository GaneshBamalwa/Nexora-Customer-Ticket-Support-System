# Unmapped Frontend Features

> Features present in the **nexora-enterprise** frontend that do **not** have a corresponding backend API endpoint yet.

## Pages & Components

| # | Feature | Location | Description | Status |
|---|---------|----------|-------------|--------|
| 1 | **About Page** | `src/pages/About.tsx` | Fully static marketing page – no API needed | ✅ Static |
| 2 | **Set Password Page** | Not yet created | Backend `/api/password/set` exists but no dedicated frontend page for it | 🔲 Needs page |
| 3 | **Google Maps Component** | `src/components/Map.tsx` | Map integration – no backend use case currently | 🔲 No backend |
| 4 | **Manus OAuth Dialog** | `src/components/ManusDialog.tsx` | External OAuth login dialog – not applicable in current auth flow | 🔲 Not needed |
| 5 | **Custom Cursor** | `src/components/CustomCursor.tsx` | Pure frontend cosmetic – no backend needed | ✅ Static |
| 6 | **Immersive 3D Background** | `src/components/ImmersiveBackground.tsx` | Three.js scene – no backend needed | ✅ Static |

## UI Interactions Without Backend

| # | Feature | Page | Description |
|---|---------|------|-------------|
| 1 | **"Forgot?" password link** | StaffLogin | Link exists but no forgot-password API flow is implemented |
| 2 | **Sidebar "Conversations" link** | AgentDashboard | Sidebar link to `/conversations` – no route or API |
| 3 | **Sidebar "My Tickets" link** | AgentDashboard | Sidebar link – currently all tickets show on dashboard |
| 4 | **Sidebar "Analytics" link** | AdminDashboard | Sidebar link – analytics data is in Overview tab already |
| 5 | **Sidebar "Team Management" link** | AdminDashboard | Sidebar link – team management is in the Performance tab |
| 6 | **"Explore AI" button** | About page | CTA button with no destination |
| 7 | **Privacy / Terms / Status links** | About footer | Static placeholder links |
| 8 | **Response Time metric** | AdminDashboard agents table | Frontend had a responseTime column – backend doesn't track this |
| 9 | **Efficiency bar** | AdminDashboard agents table | Frontend had efficiency % – backend doesn't compute this |

## Planned Features (Frontend Ready, Backend Needed)

| # | Feature | Notes |
|---|---------|-------|
| 1 | **Forgot Password flow** | Needs email-based reset token API |
| 2 | **Real-time notifications** | WebSocket or SSE for ticket updates |
| 3 | **AI Suggestion integration** | `/api/ai/suggest` returns placeholder – needs LLM integration |
| 4 | **Agent response time tracking** | Requires instrumentation in conversation logic |
| 5 | **Ticket export/download** | PDF or CSV export of ticket data |
| 6 | **Email notifications** | Notify customers when ticket status changes |
