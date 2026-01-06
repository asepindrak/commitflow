import { create } from "zustand"
import { persist } from "zustand/middleware"

type TaskReadState = {
    lastOpened: Record<string, string> // taskId -> ISO
    lastSeenBellAt: string | null

    markOpened: (taskId: string) => void
    markBellSeen: () => void
}

export const useTaskReadStore = create<TaskReadState>()(
    persist(
        (set) => ({
            lastOpened: {},
            lastSeenBellAt: null,

            // dipanggil saat task benar2 dibuka
            markOpened: (taskId) =>
                set((state) => ({
                    lastOpened: {
                        ...state.lastOpened,
                        [taskId]: new Date().toISOString(),
                    },
                })),

            // 🔥 dipanggil saat bell diklik
            markBellSeen: () =>
                set({
                    lastSeenBellAt: new Date().toISOString(),
                }),
        }),
        {
            name: "cf_task_read_v3",
        }
    )
)
