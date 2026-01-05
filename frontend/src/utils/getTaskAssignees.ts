import type { Task, TaskAssignee, TeamMember } from "../types";

export function getTaskAssignees(task: Task, team: TeamMember[]) {
    // 🆕 multi assignee
    if (Array.isArray(task.taskAssignees) && task.taskAssignees.length) {
        return task.taskAssignees.map((a: TaskAssignee) => ({
            id: a.id,
            name: a.name ?? "Unknown",
            photo: a.photo ?? undefined,
            phone: a.phone ?? undefined,
            role: a.role ?? undefined,
        }));
    }

    return [];
}
