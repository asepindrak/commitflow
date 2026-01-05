import type { Task } from "../types";

export function normalizeTaskAssignees(task: Task): Task {
    return {
        ...task,
        taskAssignees: Array.isArray(task.taskAssignees)
            ? task.taskAssignees
                .filter(a => a && a.id)
                .map(a => ({
                    id: String(a.id),
                    name: (a && a.name) ? String(a.name) : "",
                    photo: a && a.photo,
                    phone: a && a.phone,
                    role: a && a.role,
                }))
            : [],
    };
}
