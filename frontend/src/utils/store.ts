import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiLogin, apiRegister } from "../api/authApi";
import type { AuthResult } from "../api/authApi";

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
 *
 * - menggantikan anon flow; gunakan register/login/logout
 * - menyimpan token, userId, teamMemberId
 * - initSession: baca dari localStorage / persisted store, set state, dan return token (atau null)
 */
type AuthState = {
  token: string | null;
  userId: string | null;
  teamMemberId?: string | null;
  // actions
  initSession: () => Promise<string | null>;
  setAuth: (payload: {
    token: string;
    userId: string;
    teamMemberId?: string | null;
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

      // Initialize session from persisted state / localStorage
      async initSession() {
        // If already in-memory, return it
        const current = get();
        if (current.token) return current.token;

        // try reading persisted storage (zustand persist already restores before create listeners run),
        // but also check localStorage fallback key that some code might use.
        const tokenFromLS =
          localStorage.getItem("session_token") ||
          localStorage.getItem("token");
        const userIdFromLS = localStorage.getItem("userId");

        if (tokenFromLS) {
          // set store from localStorage values we found
          set({
            token: tokenFromLS,
            userId: userIdFromLS ?? null,
            // teamMemberId might be stored by our login/register response in persisted store,
            // but if you saved it to localStorage elsewhere, you can load it here too.
          });
          return tokenFromLS;
        }

        // nothing found
        return null;
      },

      setAuth(payload) {
        const { token, userId, teamMemberId } = payload;
        try {
          if (token) localStorage.setItem("session_token", token);
        } catch {
          console.log("error session_token");
        }
        try {
          if (userId) localStorage.setItem("userId", userId);
        } catch {
          console.log("error session_token");
        }
        set({ token, userId, teamMemberId: teamMemberId ?? null });
      },

      async register(payload) {
        // calls apiRegister and updates store
        const result = await apiRegister(payload);
        // result: { token, userId, teamMemberId?, clientTempId? }
        set({
          token: result.token,
          userId: result.userId,
          teamMemberId: result.teamMemberId ?? null,
        });
        try {
          localStorage.setItem("session_token", result.token);
          localStorage.setItem("userId", result.userId);
          if (result.teamMemberId)
            localStorage.setItem("teamMemberId", result.teamMemberId);
        } catch {
          console.log("error session_token");
        }
        return result;
      },

      async login(payload) {
        const result = await apiLogin(payload);
        console.log(result);
        set({
          token: result.token,
          userId: result.userId,
          teamMemberId: result.teamMemberId ?? null,
        });
        try {
          localStorage.setItem("session_token", result.token);
          localStorage.setItem("userId", result.userId);
          if (result.teamMemberId)
            localStorage.setItem("teamMemberId", result.teamMemberId);
        } catch {
          console.log("error session_token");
        }
        return result;
      },

      logout() {
        try {
          localStorage.removeItem("session_token");
          localStorage.removeItem("token");
          localStorage.removeItem("userId");
          localStorage.removeItem("teamMemberId");
        } catch {
          console.log("error session_token");
        }
        set({ token: null, userId: null, teamMemberId: null });
      },
    }),
    {
      name: "auth-storage", // key in localStorage
      // optionally you can whitelist which fields to persist:
      // getStorage: () => localStorage, // default
      // partialize: (state) => ({ token: state.token, userId: state.userId, teamMemberId: state.teamMemberId })
    }
  )
);

export { useAuthStore, useStore };
export type { Message };
