/* eslint-disable no-unused-vars */
import { apiRefresh } from "../api/authApi";
import { useAuthStore } from "./store";

/**
 * Improved apiFetch:
 * - includes credentials
 * - injects Authorization header when token available
 * - will attempt a single refresh on 401
 * - prevents concurrent refresh by using a shared refreshPromise
 * - avoids recursion on auth endpoints
 */

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
const AUTH_PATHS = [
  "/auth/refresh",
  "/auth/login",
  "/auth/register",
  "/auth/logout",
];

function normalizePath(path: string) {
  return path.replace(/\/+$/, ""); // remove trailing slash
}

/**
 * isAuthEndpoint: improved to consider API_BASE origin and relative URLs
 */
function isAuthEndpoint(url: string) {
  // Try to resolve relative urls against API_BASE (if present) or window.location.origin
  const baseOrigin = (() => {
    try {
      const u = new URL(API_BASE || window.location.origin);
      return u.origin;
    } catch {
      return window.location.origin;
    }
  })();

  try {
    const u = new URL(url, baseOrigin);
    const p = normalizePath(u.pathname);
    return AUTH_PATHS.some((auth) => {
      const normAuth = normalizePath(auth);
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

/**
 * Shared refresh controller:
 * - refreshPromise represents an ongoing initSession() call
 * - other requests await refreshPromise (to avoid parallel refresh calls)
 */
let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(authStore: any): Promise<string | null> {
  // jika sudah ada refresh sedang berlangsung, return promise yang sama
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      // panggil endpoint refresh langsung
      let parsed: any = null;
      try {
        parsed = await apiRefresh(); // harus melakukan network call (credentials: 'include')
      } catch (e) {
        console.warn("[apiFetch] apiRefresh threw:", e);
      }

      // jika apiRefresh tidak mengembalikan token, hentikan dan return null
      if (!parsed || !parsed.token) {
        return null;
      }

      // jika kita punya method setAuth, pakai itu agar store bertanggung jawab menyimpan state
      try {
        if (typeof authStore.setAuth === "function") {
          authStore.setAuth({
            token: parsed.token,
            refreshToken: parsed.refreshToken ?? null,
            userId: parsed.userId ?? null,
            user: parsed.user ?? null,
          });
        } else {
          // fallback: langsung set state via zustand setState
          // useAuthStore.setState tersedia jika kamu ingin set langsung:
          useAuthStore.setState({
            token: parsed.token,
            refreshToken: parsed.refreshToken ?? null,
            userId: parsed.userId ?? null,
            user: parsed.user ?? null,
          });
        }

        // persist ke localStorage juga (safely)
        try {
          localStorage.setItem("session_token", parsed.token);
          if (parsed.refreshToken)
            localStorage.setItem("refresh_token", parsed.refreshToken);
          if (parsed.userId) localStorage.setItem("userId", parsed.userId);
          if (parsed.user)
            localStorage.setItem("user", JSON.stringify(parsed.user));
        } catch (e) {
          console.warn(
            "[apiFetch] failed to persist refreshed auth to localStorage:",
            e
          );
        }

        return parsed.token;
      } catch (e) {
        console.warn("[apiFetch] failed to apply refreshed auth to store:", e);
        return null;
      }
    } finally {
      // pastikan promise di-clear agar bisa dicoba lagi di lain waktu
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function decodeJwtPayload(tok: string | null) {
  if (!tok) return null;
  try {
    const parts = tok.split(".");
    if (parts.length < 2) return null;
    const b = parts[1];
    const base64 = b.replace(/-/g, "+").replace(/_/g, "/");
    // atob may throw if invalid
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const EXPIRY_BUFFER_SECONDS = 30; // kalau token habis <30s, lakukan refresh dulu

export async function apiFetch(input: string, options: RequestInit = {}) {
  const authStore: any = useAuthStore.getState();

  const baseOptions: RequestInit = { credentials: "include", ...options };

  // If request is to auth endpoints, bypass the token handling to avoid recursion
  if (isAuthEndpoint(input)) {
    return fetch(input, baseOptions);
  }

  const headers: Record<string, string> = {
    ...(baseOptions.headers as Record<string, string> | undefined),
  };

  let token: string | null = authStore.token ?? null;

  // jika ada token, periksa expiry dan refresh lebih dulu bila perlu
  if (token) {
    const payload = decodeJwtPayload(token);
    if (payload?.exp) {
      const nowSec = Math.floor(Date.now() / 1000);
      const secsLeft = payload.exp - nowSec;
      if (secsLeft <= EXPIRY_BUFFER_SECONDS) {
        // token will expire soon — get a fresh one
        const fresh = await doRefresh(authStore);
        if (fresh) {
          token = fresh;
        } else {
          console.warn("[apiFetch] refresh attempt returned no token");
        }
      }
    } else {
      const fresh = await doRefresh(authStore);
      if (fresh) {
        token = fresh;
      } else {
        console.warn("[apiFetch] refresh for non-JWT token returned no token");
      }
    }
  } else {
    token = await doRefresh(authStore);
  }

  if (token) headers["Authorization"] = `Bearer ${token}`;
  const finalOptions: RequestInit = { ...baseOptions, headers };

  let res: Response;
  try {
    res = await fetch(input, finalOptions);
  } catch (err) {
    console.warn("[apiFetch] network error on fetch:", err);
    throw err;
  }

  // existing 401 flow (retry once) remains
  if (res.status === 401) {
    const newToken = await doRefresh(authStore);
    if (newToken) {
      const retryHeaders: Record<string, string> = {
        ...(finalOptions.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${newToken}`,
      };
      const retryOptions: RequestInit = {
        ...finalOptions,
        headers: retryHeaders,
      };
      try {
        res = await fetch(input, retryOptions);
      } catch (err) {
        console.warn("[apiFetch] network error on retry fetch:", err);
        throw err;
      }
    }
  }

  return res;
}
