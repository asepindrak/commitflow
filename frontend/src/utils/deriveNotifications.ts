import type { Task } from "../types"

export type DerivedNotification = {
    taskId: string
    taskName: string
    projectId: string
    projectName: string
    type: "task" | "status" | "comment"
    lastEventAt: string
    isRead: boolean
}

export function deriveNotifications(
    tasks: Task[],
    currentMemberId: string,
    lastOpened: Record<string, string>,
    lastSeenBellAt: string | null
): DerivedNotification[] {
    const result: DerivedNotification[] = []

    const bellSeenAt = lastSeenBellAt
        ? new Date(lastSeenBellAt)
        : null

    for (const t of tasks) {
        if (!t || !t.id) continue

        const projectName =
            (t as any).project?.name ??
            (t as any).projectName ??
            "Unknown Project"

        const lastOpenedAt = lastOpened[t.id]
            ? new Date(lastOpened[t.id])
            : null

        const taskUpdatedAt = new Date(
            t.updatedAt ?? t.createdAt ?? 0
        )

        // 1. Comment Event Check
        let latestCommentAt: Date | null = null
        if (Array.isArray(t.comments)) {
            for (const c of t.comments) {
                if (!c?.createdAt) continue
                // skip comment by self
                if (String(c.memberId ?? "") === String(currentMemberId)) {
                    continue
                }
                const d = new Date(c.createdAt)
                if (!latestCommentAt || d > latestCommentAt) {
                    latestCommentAt = d
                }
            }
        }

        // 2. Task Event Check (created/updated)
        let isTaskEventValid = false
        const isAssigned = t.taskAssignees?.some(
            (a: any) => String(a.memberId ?? a.id) === String(currentMemberId)
        )
        // Only valid if assigned and not updated by self
        if (
            isAssigned &&
            String(t.updatedById ?? "") !== String(currentMemberId) &&
            String(t.createdById ?? "") !== String(currentMemberId)
        ) {
            isTaskEventValid = true
        }

        // 3. Resolve the active notification event for this task
        let activeType: "task" | "status" | "comment" | null = null
        let activeEventAt: Date | null = null

        if (latestCommentAt && isTaskEventValid) {
            if (latestCommentAt >= taskUpdatedAt) {
                activeType = "comment"
                activeEventAt = latestCommentAt
            } else {
                activeType = lastOpenedAt ? "status" : "task"
                activeEventAt = taskUpdatedAt
            }
        } else if (latestCommentAt) {
            activeType = "comment"
            activeEventAt = latestCommentAt
        } else if (isTaskEventValid) {
            activeType = lastOpenedAt ? "status" : "task"
            activeEventAt = taskUpdatedAt
        }

        // If no active event, skip this task
        if (!activeType || !activeEventAt) continue

        // 4. Calculate if it is read
        let isRead = false
        if (lastOpenedAt && lastOpenedAt >= activeEventAt) {
            isRead = true
        }
        if (bellSeenAt && bellSeenAt >= activeEventAt) {
            isRead = true
        }

        result.push({
            taskId: t.id,
            taskName: t.title ?? "(Untitled task)",
            projectId: t.projectId!,
            projectName,
            type: activeType,
            lastEventAt: activeEventAt.toISOString(),
            isRead,
        })
    }

    // 5. Sort notifications: unread first (desc by date), then read (desc by date)
    result.sort((a, b) => {
        if (a.isRead !== b.isRead) {
            return a.isRead ? 1 : -1
        }
        return new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime()
    })

    // Take top 30 to prevent list overflow
    return result.slice(0, 30)
}
