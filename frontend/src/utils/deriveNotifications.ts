import type { Task } from "../types"

export type DerivedNotification = {
    taskId: string
    taskName: string
    projectId: string
    projectName: string
    type: "task" | "status" | "comment"
    lastEventAt: string
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

        /* ===============================
           ASSIGNEE CHECK
        =============================== */
        const isAssigned = t.taskAssignees?.some(
            (a: any) =>
                String(a.memberId ?? a.id) === String(currentMemberId)
        )
        if (!isAssigned) continue

        /* ===============================
           ❌ SKIP SELF-ACTION (TASK)
        =============================== */
        if (
            String(t.updatedById ?? "") === String(currentMemberId) ||
            String(t.createdById ?? "") === String(currentMemberId)
        ) {
            continue
        }

        const lastOpenedAt = lastOpened[t.id]
            ? new Date(lastOpened[t.id])
            : null

        const taskUpdatedAt = new Date(
            t.updatedAt ?? t.createdAt ?? 0
        )

        /* ===============================
           🔕 SKIP: SUDAH DILIHAT VIA BELL
        =============================== */
        if (bellSeenAt && taskUpdatedAt <= bellSeenAt) {
            continue
        }

        const projectName =
            (t as any).project?.name ??
            (t as any).projectName ??
            "Unknown Project"

        /* ===============================
           🆕 TASK BARU
        =============================== */
        if (!lastOpenedAt) {
            result.push({
                taskId: t.id,
                taskName: t.title ?? "(Untitled task)",
                projectId: t.projectId!,
                projectName,
                type: "task",
                lastEventAt: taskUpdatedAt.toISOString(),
            })
            continue
        }

        /* ===============================
           💬 KOMENTAR TERBARU (PRIORITAS)
           + ❌ SKIP SELF COMMENT
        =============================== */
        let latestCommentAt: Date | null = null

        if (Array.isArray(t.comments)) {
            for (const c of t.comments) {
                if (!c?.createdAt) continue

                // ❌ skip comment by self
                if (
                    String(c.memberId ?? "") === String(currentMemberId)
                ) {
                    continue
                }

                const d = new Date(c.createdAt)
                if (!latestCommentAt || d > latestCommentAt) {
                    latestCommentAt = d
                }
            }
        }

        if (
            latestCommentAt &&
            (!lastOpenedAt || latestCommentAt > lastOpenedAt) &&
            (!bellSeenAt || latestCommentAt > bellSeenAt)
        ) {
            result.push({
                taskId: t.id,
                taskName: t.title ?? "(Untitled task)",
                projectId: t.projectId!,
                projectName,
                type: "comment",
                lastEventAt: latestCommentAt.toISOString(),
            })
            continue
        }

        /* ===============================
           🔄 TASK UPDATE (STATUS / TITLE)
        =============================== */
        if (
            lastOpenedAt &&
            taskUpdatedAt > lastOpenedAt &&
            (!bellSeenAt || taskUpdatedAt > bellSeenAt)
        ) {
            result.push({
                taskId: t.id,
                taskName: t.title ?? "(Untitled task)",
                projectId: t.projectId!,
                projectName,
                type: "status",
                lastEventAt: taskUpdatedAt.toISOString(),
            })
        }
    }

    return result
}
