import { useMemo } from "react"
import { deriveNotifications } from "./deriveNotifications"
import { useTaskReadStore } from "./useTaskReadStore"
import type { Task } from "../types"

export function useTaskNotifications(
    tasks: Task[],
    memberId?: string
) {
    const { lastOpened, lastSeenBellAt } =
        useTaskReadStore()

    return useMemo(() => {
        if (!memberId) return []
        return deriveNotifications(
            tasks,
            memberId,
            lastOpened,
            lastSeenBellAt
        )
    }, [tasks, memberId, lastOpened, lastSeenBellAt])
}
