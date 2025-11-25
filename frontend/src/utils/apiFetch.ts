/* eslint-disable no-unused-vars */
import { useAuthStore } from "./store";

/**
 * Central fetch wrapper.
 * - automatically injects Authorization header when token available
 * - ensures credentials: 'include' is passed (so cookies work)
 * - avoids trying to refresh token when calling auth endpoints (prevents recursion)
 */

const AUTH_PATHS = [
  "/auth/refresh",
  "/auth/login",
  "/auth/register",
  "/auth/logout",
];

function normalizePath(path: string) {
  return path.replace(/\/+$/, ""); // remove trailing slash
}

function isAuthEndpoint(url: string) {
  try {
    const u = new URL(url, window.location.origin);
    const p = normalizePath(u.pathname);
    return AUTH_PATHS.some((auth) => {
      const normAuth = normalizePath(auth);
      // exact match or endsWith (handles /api prefix and other prefixes)
      return (
        p === normAuth ||
        p.endsWith(normAuth) ||
        p === `/api${normAuth}` ||
        p.endsWith(`/api${normAuth}`)
      );
    });
  } catch {
    // fallback for relative strings
    const raw = url.replace(/\/+$/, "");
    return AUTH_PATHS.some((auth) => {
      const normAuth = normalizePath(auth);
      return (
        raw === normAuth ||
        raw.endsWith(normAuth) ||
        raw.endsWith(`/api${normAuth}`)
      );
    });
  }
}

export async function apiFetch(input: string, options: RequestInit = {}) {
  const authStore: any = useAuthStore.getState();

  // ensure credentials are included so cookies (refresh token) are sent/received
  const baseOptions: RequestInit = { credentials: "include", ...options };

  // If this is an auth endpoint, DON'T attempt to initSession/attach access token.
  // This prevents recursion when initSession calls apiRefresh which uses apiFetch.
  if (isAuthEndpoint(input)) {
    // Make request directly with credentials included
    return fetch(input, baseOptions);
  }

  // For non-auth endpoints, ensure we have a token (but don't force recursion)
  let token = authStore.token ?? null;

  // If no token, attempt to initSession once (this may call apiRefresh internally)
  if (!token) {
    try {
      token = await authStore.initSession();
    } catch {
      token = null;
    }
  }

  // Build headers, but do not send Authorization if we don't have a token
  const headers: Record<string, string> = {
    ...(baseOptions.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const finalOptions: RequestInit = {
    ...baseOptions,
    headers,
  };

  let res = await fetch(input, finalOptions);

  // If backend returned 401, try a single refresh + retry (avoid infinite loops)
  if (res.status === 401) {
    try {
      const newToken = await authStore.initSession(); // this calls apiRefresh under the hood
      if (newToken) {
        const retryOptions: RequestInit = {
          ...finalOptions,
          headers: {
            ...(finalOptions.headers as Record<string, string>),
            Authorization: `Bearer ${newToken}`,
          },
        };
        res = await fetch(input, retryOptions);
      }
    } catch {
      // ignore - we'll return original 401
    }
  }

  return res;
}
