// utils/hydrateTask.ts
import type { Task, TeamMember } from "../types";

export function hydrateTask(task: Task, team: TeamMember[]): Task {
    if (!Array.isArray(task.taskAssignees)) return task;

    return {
        ...task,
        taskAssignees: task.taskAssignees.map((a: any) => {
            // 🔥 ambil member dari field yang BENAR
            const member =
                a.member ??
                team.find((t) => t.id === a.memberId);

            if (!member) return a;

            return {
                memberId: member.id,
                member, // ✅ JANGAN DIHILANGKAN
            };
        }),
    };
}
