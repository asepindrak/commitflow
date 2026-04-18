import { create } from "zustand";

export type PresenceEntry = {
  status: "online" | "offline";
  lastSeen?: string;
};

type PresenceState = {
  /** memberId → presence info */
  members: Record<string, PresenceEntry>;
  /** Set a single member's presence */
  setPresence: (
    memberId: string,
    status: "online" | "offline",
    lastSeen?: string,
  ) => void;
  /** Bulk-set from presence:list payload */
  setList: (online: string[], lastSeen: Record<string, string>) => void;
  /** Reset all */
  clear: () => void;
};

export const usePresenceStore = create<PresenceState>((set) => ({
  members: {},

  setPresence: (memberId, status, lastSeen) =>
    set((s) => ({
      members: {
        ...s.members,
        [memberId]: {
          status,
          lastSeen: lastSeen ?? s.members[memberId]?.lastSeen,
        },
      },
    })),

  setList: (online, lastSeen) =>
    set(() => {
      const members: Record<string, PresenceEntry> = {};
      for (const id of online) members[id] = { status: "online" };
      for (const [id, ts] of Object.entries(lastSeen)) {
        if (!members[id]) members[id] = { status: "offline", lastSeen: ts };
      }
      return { members };
    }),

  clear: () => set({ members: {} }),
}));
