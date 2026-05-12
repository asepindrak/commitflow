import "dotenv/config";
import logger from "vico-logger";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MAX_AI_TASKS = 100;
const MAX_AI_PROJECTS = 100;
const MAX_AI_MEMBERS = 100;
const MAX_AI_MEMBER_TASKS = 30;

/**
 * =====================================
 * PROJECTS
 * =====================================
 */
export async function getProjects(workspaceId: string) {
  try {
    console.log("getProjects");

    const results = await prisma.project.findMany({
      where: {
        isTrash: false,
        workspaceId,
      },
      select: {
        id: true,
        clientId: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        tasks: {
          where: { isTrash: false },
          select: {
            id: true,
            status: true,
            taskAssignees: {
              select: {
                memberId: true,
              },
            },
          },
        },
      },
    });

    const limitedResults = results.slice(0, MAX_AI_PROJECTS);
    const enriched = limitedResults.map((project) => {
      const tasks = project.tasks;

      return {
        id: project.id,
        clientId: project.clientId,
        name: project.name,
        description: truncateText(project.description),
        createdAt: toIso(project.createdAt),
        updatedAt: toIso(project.updatedAt),
        stats: {
          total: tasks.length,
          todo: tasks.filter((t) => t.status === "todo").length,
          inprogress: tasks.filter((t) => t.status === "inprogress").length,
          qa: tasks.filter((t) => t.status === "qa").length,
          deploy: tasks.filter((t) => t.status === "deploy").length,
          done: tasks.filter((t) => t.status === "done").length,
        },
      };
    });

    return {
      total: results.length,
      returned: enriched.length,
      truncated: results.length > enriched.length,
      projects: enriched,
    };
  } catch (error) {
    logger.error("error fetching projects", error);
    return [];
  }
}

/**
 * =====================================
 * DATE HELPERS
 * =====================================
 */
function getDateRange(dateType?: string, daysBack?: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (Number.isFinite(daysBack) && Number(daysBack) > 0) {
    const start = new Date(today);
    start.setDate(start.getDate() - Math.floor(Number(daysBack)));
    return { gte: start, lt: tomorrow };
  }
  
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  switch (dateType) {
    case "today":
      return { gte: today, lt: tomorrow };
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { gte: yesterday, lt: today };
    }
    case "this_week":
      return { gte: startOfWeek, lt: tomorrow };
    case "this_month":
      return { gte: startOfMonth, lt: tomorrow };
    case "last_7_days": {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return { gte: sevenDaysAgo, lt: tomorrow };
    }
    case "last_3_days": {
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      return { gte: threeDaysAgo, lt: tomorrow };
    }
    case "last_30_days": {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return { gte: thirtyDaysAgo, lt: tomorrow };
    }
    default:
      return null;
  }
}

/**
 * =====================================
 * TASK HELPERS
 * =====================================
 */
function baseTaskSelect() {
  return {
    id: true,
    clientId: true,
    title: true,
    description: true,
    status: true,
    priority: true,
    projectId: true,
    startDate: true,
    dueDate: true,
    finishDate: true,
    labels: true,
    sprintId: true,
    dependencies: true,
    createdAt: true,
    updatedAt: true,
    taskAssignees: {
      select: {
        memberId: true,
        member: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
      },
    },
    project: {
      select: {
        id: true,
        name: true,
      },
    },
    _count: {
      select: {
        comments: true,
      },
    },
  };
}

function toIso(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function truncateText(value?: string | null, maxLength = 240) {
  if (!value) return null;
  const sanitized = value
    .replace(
      /data:[^"'()\s>]+;base64,[A-Za-z0-9+/=\r\n]+/g,
      "[inline base64 image omitted]"
    )
    .replace(/<img\b[^>]*>/gi, "[image omitted]")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized.length > maxLength
    ? `${sanitized.slice(0, maxLength)}...`
    : sanitized;
}

function compactTask(task: any) {
  return {
    id: task.id,
    clientId: task.clientId,
    title: task.title,
    description: truncateText(task.description),
    status: task.status,
    priority: task.priority,
    projectId: task.projectId,
    project: task.project,
    startDate: task.startDate,
    dueDate: task.dueDate,
    finishDate: toIso(task.finishDate),
    labels: task.labels,
    sprintId: task.sprintId,
    dependencies: task.dependencies,
    createdAt: toIso(task.createdAt),
    updatedAt: toIso(task.updatedAt),
    commentsCount: task._count?.comments ?? 0,
    taskAssignees:
      task.taskAssignees?.map((assignee: any) => ({
        memberId: assignee.memberId,
        member: assignee.member
          ? {
              id: assignee.member.id,
              name: assignee.member.name,
              role: assignee.member.role,
              email: assignee.member.email,
            }
          : null,
      })) ?? [],
  };
}

function buildTaskResult(tasks: any[]) {
  const limitedTasks = tasks.slice(0, MAX_AI_TASKS);

  return {
    total: tasks.length,
    returned: limitedTasks.length,
    truncated: tasks.length > limitedTasks.length,
    tasks: limitedTasks.map(compactTask),
  };
}

function buildTaskWhere(
  projectId?: string,
  status?: string,
  finishDateType?: string,
  daysBack?: number,
) {
  // Only filter by project (no cross-workspace lookup)
  const where: any = { isTrash: false };

  if (projectId) {
    // Directly filter tasks by the given project id
    where.projectId = projectId;
  }

  if (status) {
    where.status = status;
  }

  // Add date range filter for finishDate if provided
  if (status === "done" && (finishDateType || daysBack)) {
    const dateRange = getDateRange(finishDateType, daysBack);
    if (dateRange) {
      where.finishDate = dateRange;
    }
  }

  return where;
}

/**
 * =====================================
 * ALL TASKS
 * =====================================
 */
export async function getAllTasks(projectId = "") {
  try {
    console.log("getAllTasks");

    const results = await prisma.task.findMany({
      where: await buildTaskWhere(projectId),
      select: baseTaskSelect(),
      orderBy: { createdAt: "desc" },
    });

    return buildTaskResult(results);
  } catch (error) {
    logger.error("error fetching getAllTasks", error);
    return [];
  }
}

/**
 * =====================================
 * TODO TASKS
 * =====================================
 */
export async function getTodoTasks(projectId = "") {
  try {
    console.log("getTodoTasks");

    const results = await prisma.task.findMany({
      where: await buildTaskWhere(projectId, "todo"),
      select: baseTaskSelect(),
      orderBy: { createdAt: "desc" },
    });

    return buildTaskResult(results);
  } catch (error) {
    logger.error("error fetching getTodoTasks", error);
    return [];
  }
}

/**
 * =====================================
 * IN PROGRESS TASKS
 * =====================================
 */
export async function getInProgressTasks(projectId = "") {
  try {
    console.log("getInProgressTasks");

    const results = await prisma.task.findMany({
      where: await buildTaskWhere(projectId, "inprogress"),
      select: baseTaskSelect(),
      orderBy: { createdAt: "desc" },
    });

    return buildTaskResult(results);
  } catch (error) {
    logger.error("error fetching getInProgressTasks", error);
    return [];
  }
}

/**
 * =====================================
 * QA TASKS
 * =====================================
 */
export async function getQaTasks(projectId = "") {
  try {
    console.log("getQaTasks");

    const results = await prisma.task.findMany({
      where: await buildTaskWhere(projectId, "qa"),
      select: baseTaskSelect(),
      orderBy: { createdAt: "desc" },
    });

    return buildTaskResult(results);
  } catch (error) {
    logger.error("error fetching getQaTasks", error);
    return [];
  }
}

/**
 * =====================================
 * DEPLOY TASKS
 * =====================================
 */
export async function getDeployTasks(projectId = "") {
  try {
    console.log("getDeployTasks");

    const results = await prisma.task.findMany({
      where: await buildTaskWhere(projectId, "deploy"),
      select: baseTaskSelect(),
      orderBy: { createdAt: "desc" },
    });

    return buildTaskResult(results);
  } catch (error) {
    logger.error("error fetching getDeployTasks", error);
    return [];
  }
}

/**
 * =====================================
 * DONE TASKS
 * =====================================
 * Retrieve done tasks with optional date filtering
 * dateType options: "today", "yesterday", "this_week", "this_month", "last_3_days", "last_7_days", "last_30_days"
 */
export async function getDoneTasks(
  projectId = "",
  dateType?: string,
  daysBack?: number,
) {
  try {
    console.log("getDoneTasks", { projectId, dateType, daysBack });

    const where = buildTaskWhere(projectId, "done", dateType, daysBack);

    const results = await prisma.task.findMany({
      where,
      select: baseTaskSelect(),
      orderBy: {
        finishDate: "desc",
      },
    });

    // Enrich results with finishDate info for AI processing
    const limitedResults = results.slice(0, MAX_AI_TASKS);
    const enriched = limitedResults.map((task: any) => ({
      ...compactTask(task),
      completedAt: task.finishDate ? task.finishDate.toISOString() : null,
      completedBy:
        task.taskAssignees?.[0]?.member?.name || "Unassigned",
      timeToCompleteDays: task.createdAt && task.finishDate
        ? Math.round(
            (new Date(task.finishDate).getTime() -
              new Date(task.createdAt).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null,
    }));

    return {
      total: results.length,
      returned: enriched.length,
      truncated: results.length > enriched.length,
      dateType: dateType ?? null,
      daysBack: daysBack ?? null,
      tasks: enriched,
    };
  } catch (error) {
    logger.error("error fetching getDoneTasks", error);
    return [];
  }
}

/**
 * =====================================
 * MEMBERS
 * =====================================
 */
export async function getMembers(workspaceId: string) {
  try {
    console.log("getMembers");

    const results = await prisma.teamMember.findMany({
      where: { isTrash: false, workspaceId },
      select: {
        id: true,
        clientId: true,
        name: true,
        role: true,
        email: true,
        taskAssignees: {
          where: {
            task: { isTrash: false }
          },
          select: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                projectId: true,
                project: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });


    const limitedResults = results.slice(0, MAX_AI_MEMBERS);
    const enriched = limitedResults.map((member) => {
      // ambil task dari pivot
      const tasks = member.taskAssignees
        .map((ta) => ta.task)
        .filter(Boolean); // safety
      const limitedTasks = tasks.slice(0, MAX_AI_MEMBER_TASKS);

      return {
        id: member.id,
        clientId: member.clientId,
        name: member.name,
        role: member.role,
        email: member.email,

        stats: {
          total: tasks.length,
          todo: tasks.filter((t) => t.status === "todo").length,
          inprogress: tasks.filter((t) => t.status === "inprogress").length,
          qa: tasks.filter((t) => t.status === "qa").length,
          deploy: tasks.filter((t) => t.status === "deploy").length,
          done: tasks.filter((t) => t.status === "done").length,
        },

        tasksReturned: limitedTasks.length,
        tasksTruncated: tasks.length > limitedTasks.length,
        tasks: limitedTasks,
      };
    });


    return {
      total: results.length,
      returned: enriched.length,
      truncated: results.length > enriched.length,
      members: enriched,
    };
  } catch (error) {
    logger.error("error fetching getMembers", error);
    return [];
  }
}

export async function getUnassignedTasks(projectId: string = "") {
  try {
    console.log("getUnassignedTasks");

    const where: any = {
      isTrash: false,
      taskAssignees: {
        none: {}, // 🔥 inti multi-assignee
      },
    };

    if (projectId) {
      where.projectId = projectId;
    }

    const results = await prisma.task.findMany({
      where,
      select: baseTaskSelect(),
      orderBy: { createdAt: "desc" },
    });

    return buildTaskResult(results);
  } catch (error) {
    logger.error("error fetching getUnassignedTasks", error);
    return [];
  }
}


export async function getUrgentTasks(projectId: string = "") {
  try {
    console.log("getUrgentTasks");

    const where: any = {
      isTrash: false,
      priority: "urgent",
    };

    if (projectId) where.projectId = projectId;

    const results = await prisma.task.findMany({
      where,
      select: baseTaskSelect(),
      orderBy: { createdAt: "desc" },
    });

    return buildTaskResult(results);
  } catch (error) {
    logger.error("error fetching getUrgentTasks", error);
    return [];
  }
}

export async function getLowTasks(projectId: string = "") {
  try {
    console.log("getLowTasks");

    const where: any = {
      isTrash: false,
      priority: "low",
    };

    if (projectId) where.projectId = projectId;

    const results = await prisma.task.findMany({
      where,
      select: baseTaskSelect(),
      orderBy: { createdAt: "desc" },
    });

    return buildTaskResult(results);
  } catch (error) {
    logger.error("error fetching getLowTasks", error);
    return [];
  }
}

export async function getMediumTasks(projectId: string = "") {
  try {
    console.log("getMediumTasks");

    const where: any = {
      isTrash: false,
      priority: "medium",
    };

    if (projectId) where.projectId = projectId;

    const results = await prisma.task.findMany({
      where,
      select: baseTaskSelect(),
      orderBy: { createdAt: "desc" },
    });

    return buildTaskResult(results);
  } catch (error) {
    logger.error("error fetching getMediumTasks", error);
    return [];
  }
}
