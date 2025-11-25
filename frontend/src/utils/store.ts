/* eslint-disable no-empty */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiLogin, apiRegister, apiRefresh, apiLogout } from "../api/authApi";
import type { AuthResult } from "../api/authApi";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

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

/**
 * Auth store (persisted)
 */

// Top-level guards to prevent refresh storms and duplicate attempts per page load
let refreshPromise: Promise<string | null> | null = null;
let refreshAttempted = false; // ensure we only try refresh once per page load unless explicitly desired

type AuthState = {
  token: string | null;
  userId: string | null;
  teamMemberId?: string | null;
  user?: any | null;
  // actions
  initSession: () => Promise<string | null>;
  setAuth: (payload: {
    token: string;
    userId: string;
    teamMemberId?: string | null;
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
      userId: null,
      teamMemberId: null,
      user: null,

      // Initialize session from persisted state / localStorage
      async initSession() {
        const current = get();
        if (current.token) return current.token;

        // Try localStorage first (backwards compat)
        const tokenFromLS =
          localStorage.getItem("session_token") ||
          localStorage.getItem("token");
        const userIdFromLS = localStorage.getItem("userId");
        const userFromLS = localStorage.getItem("user")
          ? JSON.parse(localStorage.getItem("user")!)
          : null;

        if (tokenFromLS) {
          set({
            token: tokenFromLS,
            userId: userIdFromLS ?? null,
            user: userFromLS ?? null,
          });
          return tokenFromLS;
        }

        // If we've already tried refresh this page load, don't spam the server again
        if (refreshAttempted) return null;

        // If a refresh request is already in flight, await it
        if (refreshPromise) return await refreshPromise;

        refreshAttempted = true;
        refreshPromise = (async () => {
          try {
            const parsed = await apiRefresh();
            if (parsed?.token) {
              set({
                token: parsed.token,
                userId: localStorage.getItem("userId") ?? null,
                user: userFromLS ?? null,
              });
              try {
                localStorage.setItem("session_token", parsed.token);
              } catch {}
              return parsed.token;
            }
            return null;
          } catch (e) {
            try {
              localStorage.removeItem("session_token");
            } catch {}
            return null;
          } finally {
            refreshPromise = null;
          }
        })();

        return await refreshPromise;
      },

      setAuth(payload) {
        const { token, userId, teamMemberId, user } = payload;
        try {
          if (token) localStorage.setItem("session_token", token);
        } catch {
          console.log("error session_token");
        }
        try {
          if (userId) localStorage.setItem("userId", userId);
          if (user) localStorage.setItem("user", JSON.stringify(user));
        } catch {
          console.log("error session_token");
        }
        set({ token, userId, user, teamMemberId: teamMemberId ?? null });
      },

      async register(payload: any) {
        const result: AuthResult = await apiRegister(payload);
        set({
          token: result.token,
          userId: result.userId,
          user: result.user,
          teamMemberId: result.teamMemberId ?? null,
        });
        try {
          localStorage.setItem("session_token", result.token);
          localStorage.setItem("userId", result.userId);
          localStorage.setItem("user", JSON.stringify(result.user));
          if (result.teamMemberId)
            localStorage.setItem("teamMemberId", result.teamMemberId);
        } catch {}
        return result;
      },

      async login(payload) {
        const result: AuthResult = await apiLogin(payload);
        set({
          token: result.token,
          userId: result.userId,
          user: result.user,
          teamMemberId: result.teamMemberId ?? null,
        });
        try {
          localStorage.setItem("session_token", result.token);
          localStorage.setItem("userId", result.userId);
          localStorage.setItem("user", JSON.stringify(result.user));
          if (result.teamMemberId)
            localStorage.setItem("teamMemberId", result.teamMemberId);
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

        try {
          localStorage.removeItem("session_token");
          localStorage.removeItem("token");
          localStorage.removeItem("userId");
          localStorage.removeItem("teamMemberId");
          localStorage.removeItem("user");
        } catch {}

        // clear guards so a new session on the same page load can attempt refresh again
        refreshAttempted = false;
        refreshPromise = null;

        set({ token: null, userId: null, teamMemberId: null, user: null });
      },
    }),
    { name: "auth-storage" }
  )
);

export { useAuthStore, useStore };
export type { Message };
