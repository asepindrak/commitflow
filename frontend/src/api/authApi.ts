import { apiFetch } from "../utils/apiFetch";

// Choose BASE depending on environment. In development use VITE_API_URL if provided
// otherwise default to localhost:8000 (your docker host mapping).
const BASE =
  import.meta.env.MODE === "development"
    ? import.meta.env.VITE_API_URL?.replace(/\/$/, "") ??
      "http://localhost:8000"
    : import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

async function parseJson(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function makeError(res: Response, parsed: any) {
  const msg =
    (parsed && (parsed.message || parsed.error)) ||
    res.statusText ||
    `HTTP ${res.status}`;
  return new Error(msg);
}

export type AuthResult = {
  token: string;
  userId: string;
  user: any | null;
  clientTempId?: string | null;
};

export async function apiRegister(payload: {
  clientTempId?: string;
  workspace: string;
  email: string;
  name: string;
  password?: string;
  role?: string;
  photo?: string;
}): Promise<AuthResult> {
  const res = await apiFetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function apiLogin(payload: {
  email: string;
  password?: string;
}): Promise<AuthResult> {
  const res = await apiFetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

// Exchange refresh-cookie -> access token (used on app startup)
export async function apiRefresh(): Promise<{ token: string }> {
  const res = await apiFetch(`${BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed as { token: string };
}

// Logout: tell server to revoke & clear cookie
export async function apiLogout(): Promise<{ ok: boolean }> {
  const res = await apiFetch(`${BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed as { ok: boolean };
}
