/**
 * Nexora API Client
 * ─────────────────
 * Centralised HTTP client with automatic JWT injection,
 * error handling, and type-safe request helpers.
 */

const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("nexora_token");
}

function setToken(token: string): void {
  localStorage.setItem("nexora_token", token);
}

function clearToken(): void {
  localStorage.removeItem("nexora_token");
  localStorage.removeItem("nexora_user");
}

function getStoredUser(): any | null {
  const raw = localStorage.getItem("nexora_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function setStoredUser(user: any): void {
  localStorage.setItem("nexora_user", JSON.stringify(user));
}

async function request<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    window.location.href = "/staff-login";
    throw new Error("Session expired");
  }

  if (response.status === 429) {
    throw new Error("Too many requests. Please slow down.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed (${response.status})`);
  }

  return response.json();
}

// ─── PUBLIC ENDPOINTS ────────────────────────────────────────────────────────

export async function raiseTicket(data: {
  email: string;
  subject: string;
  description: string;
  priority: string;
}) {
  return request("/tickets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function searchHistory(data: {
  email: string;
  filter_status?: string | null;
  filter_priority?: string | null;
}) {
  return request("/tickets/search", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getConversation(ticketId: number) {
  return request(`/tickets/${ticketId}/conversation`);
}

export async function postConversation(ticketId: number, message: string) {
  return request(`/tickets/${ticketId}/conversation`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function rateTicket(ticketId: number, rating: number) {
  return request(`/tickets/${ticketId}/rate/${rating}`);
}

export async function followUp(ticketId: number) {
  return request(`/tickets/${ticketId}/follow-up`);
}

// ─── AUTH ────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const data = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data.token) {
    setToken(data.token);
    setStoredUser(data.user);
  }
  return data;
}

export async function getMe() {
  return request("/auth/me");
}

export function logout() {
  clearToken();
  window.location.href = "/";
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getCurrentUser(): any | null {
  return getStoredUser();
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────

export async function getDashboard(params?: {
  status?: string;
  priority?: string;
  date?: string;
}) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status_filter", params.status);
  if (params?.priority) query.set("priority", params.priority);
  if (params?.date) query.set("date", params.date);
  const qs = query.toString();
  return request(`/dashboard${qs ? `?${qs}` : ""}`);
}

export async function resolveTicket(ticketId: number) {
  return request(`/tickets/${ticketId}/resolve`, { method: "POST" });
}

// ─── ADMIN ──────────────────────────────────────────────────────────────────

export async function getAdminReport() {
  return request("/admin/report");
}

export async function addAgent(data: {
  name: string;
  email: string;
  role: string;
  temp_password?: string;
}) {
  return request("/admin/agents", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteAgent(agentId: number) {
  return request(`/admin/agents/${agentId}`, { method: "DELETE" });
}

export async function assignTicket(ticketId: number, agentId: number | null) {
  return request(`/admin/tickets/${ticketId}/assign`, {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId }),
  });
}

export async function handlePwRequest(reqId: number, action: "approve" | "deny") {
  return request(`/admin/pw-requests/${reqId}/${action}`, { method: "POST" });
}

// ─── PASSWORD ───────────────────────────────────────────────────────────────

export async function getPasswordStatus() {
  return request("/password/status");
}

export async function setPassword(password: string, confirm: string) {
  return request("/password/set", {
    method: "POST",
    body: JSON.stringify({ password, confirm }),
  });
}

export async function requestPasswordChange() {
  return request("/password/request-change", { method: "POST" });
}

// ─── AI ─────────────────────────────────────────────────────────────────────

export async function aiSuggest() {
  return request("/ai/suggest", { method: "POST" });
}

// ─── SQL CONSOLE ────────────────────────────────────────────────────────────

export async function getSqlMetadata() {
  return request("/sql/metadata");
}

export async function runSqlQuery(query: string) {
  return request("/sql/query", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export { getToken, setToken, clearToken, getStoredUser, setStoredUser };
