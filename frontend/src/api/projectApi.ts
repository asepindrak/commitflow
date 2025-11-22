// frontend/src/api/projectApi.ts
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

/**
 * Workspaces
 */
export async function getWorkspaces() {
  const res = await apiFetch(`${BASE}/api/project-management/workspaces`, {
    method: "GET",
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function createWorkspace(payload: any) {
  const res = await apiFetch(`${BASE}/api/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

/**
 * State / bootstrap
 */
export async function getState(workspaceId: string) {
  const res = await apiFetch(
    `${BASE}/api/project-management/state/${workspaceId}`,
    {
      method: "GET",
    }
  );
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

/**
 * Projects
 */
export async function getProjects(workspaceId: string) {
  const res = await apiFetch(`${BASE}/api/projects/${workspaceId}`, {
    method: "GET",
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function createProject(payload: any) {
  const res = await apiFetch(`${BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function updateProjectApi(id: string, payload: any) {
  const res = await apiFetch(`${BASE}/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function deleteProjectApi(id: string) {
  const res = await apiFetch(`${BASE}/api/projects/${id}`, {
    method: "DELETE",
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

/**
 * Tasks
 */
export async function getTasks(projectId?: string) {
  const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const res = await apiFetch(`${BASE}/api/tasks${q}`, { method: "GET" });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function createTask(payload: any) {
  const res = await apiFetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function updateTaskApi(id: string, payload: any) {
  const res = await apiFetch(`${BASE}/api/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function patchTaskApi(id: string, patch: any) {
  const res = await apiFetch(`${BASE}/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function deleteTaskApi(id: string) {
  const res = await apiFetch(`${BASE}/api/tasks/${id}`, { method: "DELETE" });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

/**
 * Task Comments
 */

export async function getTaskComments(taskId: string) {
  const res = await apiFetch(`${BASE}/api/tasks/${taskId}/comments`, {
    method: "GET",
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function createComment(
  taskId: string,
  payload: { author: string; body: string; attachments?: any[] }
) {
  const res = await apiFetch(`${BASE}/api/tasks/${taskId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed; // should return new comment { id, author, body, createdAt, attachments }
}

export async function deleteComment(taskId: string, commentId: string) {
  const res = await apiFetch(
    `${BASE}/api/tasks/${taskId}/comments/${commentId}`,
    { method: "DELETE" }
  );
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function updateComment(
  taskId: string,
  commentId: string,
  patch: { body?: string; attachments?: any[] }
) {
  const res = await apiFetch(
    `${BASE}/api/tasks/${taskId}/comments/${commentId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }
  );
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

/**
 * Team members
 */
export async function getTeam() {
  const res = await apiFetch(`${BASE}/api/team`, { method: "GET" });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function createTeamMember(payload: any) {
  const res = await apiFetch(`${BASE}/api/team`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function updateTeamMember(id: string, payload: any) {
  const res = await apiFetch(`${BASE}/api/team/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

export async function deleteTeamMember(id: string) {
  const res = await apiFetch(`${BASE}/api/team/${id}`, { method: "DELETE" });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

/**
 * Export / Import helpers (server-side export or upload import)
 */
export async function exportXlsx() {
  const res = await apiFetch(`${BASE}/api/project-management/export`, {
    method: "GET",
  });
  if (!res.ok) {
    const parsed = await parseJson(res);
    throw makeError(res, parsed);
  }
  // return blob for download handling in frontend
  const blob = await res.blob();
  return blob;
}

export async function importXlsx(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch(`${BASE}/api/project-management/import`, {
    method: "POST",
    body: form,
  });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}

/**
 * Misc: upload (if you decide to route uploads through backend)
 * Note: you already have frontend upload helper that posts to `${VITE_API_URL}/upload`.
 * Keep this here if you prefer using REST wrapper.
 */
export async function uploadFileApi(file: File, folder = "") {
  const form = new FormData();
  form.append("file", file);
  if (folder) form.append("folder", folder);
  const res = await apiFetch(`${BASE}/upload`, { method: "POST", body: form });
  const parsed = await parseJson(res);
  if (!res.ok) throw makeError(res, parsed);
  return parsed;
}
