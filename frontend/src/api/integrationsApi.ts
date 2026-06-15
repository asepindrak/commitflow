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

// --- Webhooks ---
export async function getWebhooksApi(workspaceId: string) {
  const res = await apiFetch(`${BASE}/api/integrations/webhooks/${workspaceId}`);
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function createWebhookApi(payload: {
  workspaceId: string;
  url: string;
  events: string[];
}) {
  const res = await apiFetch(`${BASE}/api/integrations/webhooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function toggleWebhookApi(id: string) {
  const res = await apiFetch(`${BASE}/api/integrations/webhooks/${id}/toggle`, {
    method: "PUT",
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function deleteWebhookApi(id: string) {
  const res = await apiFetch(`${BASE}/api/integrations/webhooks/${id}`, {
    method: "DELETE",
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

// --- Telegram ---
export async function getTelegramIntegrationsApi(workspaceId: string) {
  const res = await apiFetch(`${BASE}/api/integrations/telegram/${workspaceId}`);
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function createTelegramIntegrationApi(payload: {
  workspaceId: string;
  botToken: string;
  telegramId: string;
  events: string[];
}) {
  const res = await apiFetch(`${BASE}/api/integrations/telegram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function toggleTelegramIntegrationApi(id: string) {
  const res = await apiFetch(`${BASE}/api/integrations/telegram/${id}/toggle`, {
    method: "PUT",
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function deleteTelegramIntegrationApi(id: string) {
  const res = await apiFetch(`${BASE}/api/integrations/telegram/${id}`, {
    method: "DELETE",
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}
