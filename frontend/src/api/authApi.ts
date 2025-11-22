// src/api/authApi.ts
import { apiFetch } from "../utils/apiFetch";
const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

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
  teamMemberId?: string | null;
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
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}
