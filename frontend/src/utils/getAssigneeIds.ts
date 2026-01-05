import type { Task } from "../types";

export function getAssigneeIds(task: Task): string[] {
    const list = task?.taskAssignees ?? [];
    return list
        .map((a: any) => a?.member?.id)
        .filter(Boolean)
        .map(String)
        .sort(); // IMPORTANT: order-independent
}
