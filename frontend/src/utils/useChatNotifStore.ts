import { create } from "zustand";

export type ChatNotif = {
  id: string;
  type: "message" | "mention";
  senderName: string;
  content: string;
  workspaceName?: string;
  createdAt: string;
};

type ChatNotifState = {
  notifs: ChatNotif[];
  push: (n: ChatNotif) => void;
  clear: () => void;
  dismiss: (id: string) => void;
};

export const useChatNotifStore = create<ChatNotifState>((set) => ({
  notifs: [],
  push: (n) =>
    set((s) => {
      if (s.notifs.some((x) => x.id === n.id)) return s;
      return { notifs: [n, ...s.notifs].slice(0, 50) };
    }),
  clear: () => set({ notifs: [] }),
  dismiss: (id) =>
    set((s) => ({ notifs: s.notifs.filter((n) => n.id !== id) })),
}));
