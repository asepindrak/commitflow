import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

@Injectable()
export class DashboardService {
  async getStats(workspaceId: string) {
    // Get all projects in workspace
    const projects = await prisma.project.findMany({
      where: { workspaceId, isTrash: false },
      select: { id: true, name: true },
    });

    const projectIds = projects.map((p) => p.id);

    // Get all active tasks
    const tasks = await prisma.task.findMany({
      where: {
        isTrash: false,
        projectId: { in: projectIds },
      },
      select: {
        id: true,
        status: true,
        priority: true,
        projectId: true,
        dueDate: true,
        createdAt: true,
        finishDate: true,
        taskAssignees: {
          select: {
            memberId: true,
            member: { select: { name: true, photo: true } },
          },
        },
      },
    });

    // Get team members
    const team = await prisma.teamMember.findMany({
      where: { workspaceId, isTrash: false },
      select: { id: true, name: true, photo: true, role: true },
    });

    // ── Compute stats ──
    const statusCounts: Record<string, number> = {};
    const priorityCounts: Record<string, number> = {};
    const projectTaskCounts: Record<string, number> = {};
    const memberTaskCounts: Record<string, number> = {};
    let overdue = 0;
    let dueToday = 0;
    let dueSoon = 0; // within 3 days

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const soonDate = new Date();
    soonDate.setDate(now.getDate() + 3);
    const soonStr = soonDate.toISOString().slice(0, 10);

    // Tasks created in last 7 days (for velocity)
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);
    let createdThisWeek = 0;
    let completedThisWeek = 0;

    for (const t of tasks) {
      // Status count
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;

      // Priority count
      const pri = t.priority ?? "none";
      priorityCounts[pri] = (priorityCounts[pri] || 0) + 1;

      // Project count
      if (t.projectId) {
        projectTaskCounts[t.projectId] =
          (projectTaskCounts[t.projectId] || 0) + 1;
      }

      // Member workload
      for (const a of t.taskAssignees) {
        memberTaskCounts[a.memberId] = (memberTaskCounts[a.memberId] || 0) + 1;
      }

      // Due dates
      if (t.dueDate && t.status !== "done") {
        if (t.dueDate < todayStr) overdue++;
        else if (t.dueDate === todayStr) dueToday++;
        else if (t.dueDate <= soonStr) dueSoon++;
      }

      // Velocity
      if (t.createdAt >= weekAgo) createdThisWeek++;
      if (t.status === "done" && t.finishDate && t.finishDate >= weekAgo) {
        completedThisWeek++;
      }
    }

    // Build structured response
    return {
      totalTasks: tasks.length,
      totalProjects: projects.length,
      totalMembers: team.length,
      statusCounts,
      priorityCounts,
      overdue,
      dueToday,
      dueSoon,
      createdThisWeek,
      completedThisWeek,
      projectStats: projects.map((p) => ({
        id: p.id,
        name: p.name,
        taskCount: projectTaskCounts[p.id] || 0,
      })),
      memberWorkload: team.map((m) => ({
        id: m.id,
        name: m.name,
        photo: m.photo,
        role: m.role,
        taskCount: memberTaskCounts[m.id] || 0,
      })),
    };
  }
}
