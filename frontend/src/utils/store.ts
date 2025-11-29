/* eslint-disable no-empty */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiLogin, apiRegister, apiRefresh, apiLogout } from "../api/authApi";
import type { AuthResult } from "../api/authApi";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

/** helpers untuk localStorage ops yang kita gunakan berulang */
function safeSetItem(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}
function safeRemoveItem(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {}
}
function clearSessionStorage() {
  safeRemoveItem("session_token");
  safeRemoveItem("refresh_token");
  safeRemoveItem("token");
  safeRemoveItem("userId");
  safeRemoveItem("user");
}

/**
 * Message store (persisted) — sama seperti yang kamu punya
 */
type Message = {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  createdAt?: string;
  updatedAt?: string;
};

type MessageStore = {
  messages: Message[];
  setMessages: (updater: (prev: Message[]) => Message[]) => void;
};

const useStore = create<MessageStore>()(
  persist(
    (set) => ({
      messages: [],
      setMessages: (updater) =>
        set((state) => ({
          messages: updater(state.messages),
        })),
    }),
    { name: "chat-storage" }
  )
);

export const useStoreWorkspace = create<any>()(
  persist(
    (set) => ({
      workspaceId: "",
      projectId: "",
      setWorkspaceId: (value: string) => set({ workspaceId: value }),

      setProjectId: (value: string) => set({ projectId: value }),
    }),
    {
      name: "workspace-storage",
    }
  )
);

/**
 * Auth store (persisted)
 */

// Top-level guards to prevent refresh storms and duplicate attempts per page load
let refreshPromise: Promise<string | null> | null = null;

type AuthState = {
  token: string | null;
  refreshToken?: string | null;
  userId: string | null;
  user?: any | null;
  // actions
  initSession: () => Promise<string | null>;
  setAuth: (payload: {
    token: string;
    refreshToken?: string | null;
    userId: string;
    user?: any | null;
  }) => void;
  register: (payload: {
    email: string;
    name: string;
    password?: string;
    clientTempId?: string;
  }) => Promise<AuthResult>;
  login: (payload: { email: string; password?: string }) => Promise<AuthResult>;
  logout: () => void;
};

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      userId: null,
      user: null,

      // Initialize session from persisted state / localStorage
      async initSession() {
        const current = get();
        // If we already have an in-memory token, just return it (no double refresh).
        if (current.token) return current.token;

        // Read localStorage values but DON'T set in-memory yet.
        const tokenFromLS =
          localStorage.getItem("session_token") ||
          localStorage.getItem("token");
        const refreshFromLS = localStorage.getItem("refresh_token");
        const userIdFromLS = localStorage.getItem("userId");
        const userFromLS = localStorage.getItem("user")
          ? JSON.parse(localStorage.getItem("user")!)
          : null;

        // If a refresh request is already in flight, await it
        if (refreshPromise) {
          return await refreshPromise;
        }

        // Start a refresh attempt (defensive + logging)
        refreshPromise = (async () => {
          try {
            // defensive check: ensure apiRefresh is defined
            if (typeof apiRefresh !== "function") {
              console.error(
                "[initSession] apiRefresh is not a function! falling back to direct fetch."
              );
              throw new Error("apiRefresh_missing");
            }

            // try normal apiRefresh first
            let parsed: any = null;
            try {
              parsed = await apiRefresh();
            } catch (e) {
              console.warn("[initSession] apiRefresh threw error:", e);
            }

            // If apiRefresh returned nothing (or returned stale token without network),
            // fallback to doing a direct fetch to the refresh endpoint so we can see it in Network.
            // Build URL respecting API_BASE if present.
            const base =
              (import.meta.env.VITE_API_URL || "").replace(/\/$/, "") || "";
            const refreshUrl = base ? `${base}/auth/refresh` : "/auth/refresh";

            if ((!parsed || !parsed.token) && !parsed?.__ok_from_apiRefresh) {
              // add timing log so we can see this path in console
              try {
                const resp = await fetch(refreshUrl, {
                  method: "POST", // or GET depending on your server. try POST first.
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  // no body: server should use cookie; if your server expects body, change accordingly
                });

                if (resp.ok) {
                  try {
                    const body = await resp.json();
                    parsed = body;
                    // mark that parsed came from real fetch
                    parsed.__ok_from_direct_fetch = true;
                  } catch (e) {
                    console.warn(
                      "[initSession] direct fetch ok but failed to parse json:",
                      e
                    );
                  }
                } else {
                  console.warn(
                    "[initSession] direct fetch returned non-ok status:",
                    resp.status
                  );
                }
              } catch (e) {
                console.warn(
                  "[initSession] direct fetch to refresh endpoint failed:",
                  e
                );
              }
            } else {
              console.debug(
                "[initSession] apiRefresh returned parsed:",
                parsed && { hasToken: !!parsed.token }
              );
            }

            // If parsed contains token — use it
            if (parsed?.token) {
              set({
                token: parsed.token,
                refreshToken: parsed.refreshToken ?? null,
                userId: parsed.userId ?? null,
                user: parsed.user ?? null,
              });

              try {
                localStorage.setItem("session_token", parsed.token);
                if (parsed.refreshToken)
                  localStorage.setItem("refresh_token", parsed.refreshToken);
                if (parsed.userId)
                  localStorage.setItem("userId", parsed.userId);
                if (parsed.user)
                  localStorage.setItem("user", JSON.stringify(parsed.user));
              } catch {}

              return parsed.token;
            }

            // No token from server. Fallback to tokenFromLS if available (soft fallback)
            if (tokenFromLS) {
              console.debug(
                "[initSession] no token from refresh; falling back to tokenFromLS"
              );
              set({
                token: tokenFromLS,
                refreshToken: refreshFromLS ?? null,
                userId: userIdFromLS ?? null,
                user: userFromLS ?? null,
              });
              return tokenFromLS;
            }

            // nothing anywhere -> clear
            console.debug(
              "[initSession] no token anywhere -> clearing session"
            );
            try {
              localStorage.removeItem("session_token");
              localStorage.removeItem("refresh_token");
              localStorage.removeItem("token");
              localStorage.removeItem("userId");
              localStorage.removeItem("user");
            } catch {}

            set({
              token: null,
              refreshToken: null,
              userId: null,
              user: null,
            });
            return null;
          } catch (err) {
            console.error(
              "[initSession] unexpected error during refresh:",
              err
            );
            // fallback to tokenFromLS if available
            if (tokenFromLS) {
              set({
                token: tokenFromLS,
                refreshToken: refreshFromLS ?? null,
                userId: userIdFromLS ?? null,
                user: userFromLS ?? null,
              });
              return tokenFromLS;
            }
            try {
              localStorage.removeItem("session_token");
              localStorage.removeItem("refresh_token");
              localStorage.removeItem("token");
              localStorage.removeItem("userId");
              localStorage.removeItem("user");
            } catch {}
            set({
              token: null,
              refreshToken: null,
              userId: null,
              user: null,
            });
            return null;
          } finally {
            refreshPromise = null;
          }
        })();

        return await refreshPromise;
      },

      setAuth(payload) {
        const { token, refreshToken, userId, user } = payload;
        try {
          if (token) safeSetItem("session_token", token);
          if (refreshToken) safeSetItem("refresh_token", refreshToken);
        } catch {}
        try {
          if (userId) safeSetItem("userId", userId);
          if (user) safeSetItem("user", JSON.stringify(user));
        } catch {}
        set({
          token: token ?? null,
          refreshToken: refreshToken ?? null,
          userId: userId ?? null,
          user: user ?? null,
        });
      },

      async register(payload: any) {
        const result: AuthResult = await apiRegister(payload);
        set({
          token: result.token,
          refreshToken: (result as any).refreshToken ?? null,
          userId: result.userId,
          user: result.user,
        });
        try {
          safeSetItem("session_token", result.token);
          if ((result as any).refreshToken)
            safeSetItem("refresh_token", (result as any).refreshToken);
          safeSetItem("userId", result.userId);
          safeSetItem("user", JSON.stringify(result.user));
        } catch {}
        return result;
      },

      async login(payload) {
        const result: AuthResult = await apiLogin(payload);
        set({
          token: result.token,
          refreshToken: (result as any).refreshToken ?? null,
          userId: result.userId,
          user: result.user,
        });
        try {
          safeSetItem("session_token", result.token);
          if ((result as any).refreshToken)
            safeSetItem("refresh_token", (result as any).refreshToken);
          safeSetItem("userId", result.userId);
          safeSetItem("user", JSON.stringify(result.user));
        } catch {}
        return result;
      },

      logout() {
        (async () => {
          try {
            await apiLogout();
          } catch (e) {
            console.warn("Logout request failed:", e);
          }
        })();

        clearSessionStorage();

        // clear guards so a new session on the same page load can attempt refresh again
        refreshPromise = null;

        set({
          token: null,
          refreshToken: null,
          userId: null,
          user: null,
        });
      },
    }),
    { name: "auth-storage" }
  )
);

export { useAuthStore, useStore };
export type { Message };
