import "dotenv/config";
import logger from "vico-logger";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * =====================================
 * PROJECTS
 * =====================================
 */
export async function getProjects(userId: string) {
  try {
    console.log("getProjects");
    const team = await prisma.teamMember.findMany({
      where: {
        userId,
      },
    });
    const workspaceIds = team.map((item: any) => item.workspaceId);

    const results = await prisma.project.findMany({
      where: {
        isTrash: false,
        workspaceId: {
          in: workspaceIds,
        },
      },
      include: {
        tasks: {
          where: { isTrash: false },
          select: {
            id: true,
            status: true,
            assigneeId: true,
          },
        },
      },
    });

    const enriched = results.map((project) => {
      const tasks = project.tasks;

      return {
        id: project.id,
        clientId: project.clientId,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        stats: {
          total: tasks.length,
          todo: tasks.filter((t) => t.status === "todo").length,
          inprogress: tasks.filter((t) => t.status === "inprogress").length,
          done: tasks.filter((t) => t.status === "done").length,
        },
      };
    });

    return enriched;
  } catch (error) {
    logger.error("error fetching projects", error);
    return [];
  }
}

/**
 * =====================================
 * TASK HELPERS
 * =====================================
 */
function baseTaskInclude() {
  return {
    assignee: {
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        photo: true,
      },
    },
    project: {
      select: {
        id: true,
        name: true,
      },
    },
    comments: true,
  };
}

function buildTaskWhere(userId: string, projectId?: string, status?: string) {
  // Only filter by project (no cross-workspace lookup)
  const where: any = { isTrash: false };

  if (projectId) {
    // Directly filter tasks by the given project id
    where.projectId = projectId;
  }

  if (status) {
    where.status = status;
  }

  return where;
}

/**
 * =====================================
 * ALL TASKS
 * =====================================
 */
export async function getAllTasks(projectId = "", userId: string) {
  try {
    console.log("getAllTasks");

    const results = await prisma.task.findMany({
      where: await buildTaskWhere(userId, projectId),
      include: baseTaskInclude(),
      orderBy: { createdAt: "desc" },
    });

    return results;
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
export async function getTodoTasks(projectId = "", userId: string) {
  try {
    console.log("getTodoTasks");

    const results = await prisma.task.findMany({
      where: await buildTaskWhere(userId, projectId, "todo"),
      include: baseTaskInclude(),
      orderBy: { createdAt: "desc" },
    });

    return results;
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
export async function getInProgressTasks(projectId = "", userId: string) {
  try {
    console.log("getInProgressTasks");

    const results = await prisma.task.findMany({
      where: await buildTaskWhere(userId, projectId, "inprogress"),
      include: baseTaskInclude(),
      orderBy: { createdAt: "desc" },
    });

    return results;
  } catch (error) {
    logger.error("error fetching getInProgressTasks", error);
    return [];
  }
}

/**
 * =====================================
 * DONE TASKS
 * =====================================
 */
export async function getDoneTasks(projectId = "", userId: string) {
  try {
    console.log("getDoneTasks");

    const results = await prisma.task.findMany({
      where: await buildTaskWhere(userId, projectId, "done"),
      include: baseTaskInclude(),
      orderBy: { createdAt: "desc" },
    });

    return results;
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
export async function getMembers(userId: string) {
  try {
    console.log("getMembers");

    const results = await prisma.teamMember.findMany({
      where: { isTrash: false },
      include: {
        Task: {
          where: { isTrash: false },
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
      orderBy: { name: "asc" },
    });

    const enriched = results.map((member) => ({
      id: member.id,
      clientId: member.clientId,
      name: member.name,
      role: member.role,
      email: member.email,
      phone: member.phone,
      photo: member.photo,
      stats: {
        total: member.Task.length,
        todo: member.Task.filter((t) => t.status === "todo").length,
        inprogress: member.Task.filter((t) => t.status === "inprogress").length,
        done: member.Task.filter((t) => t.status === "done").length,
      },
      tasks: member.Task,
    }));

    return enriched;
  } catch (error) {
    logger.error("error fetching getMembers", error);
    return [];
  }
}

export async function getUnassignedTasks(
  projectId: string = "",
  userId: string
) {
  try {
    console.log("getUnassignedTasks");

    const where: any = {
      isTrash: false,
      assigneeId: null,
    };

    if (projectId) where.projectId = projectId;

    const results = await prisma.task.findMany({
      where,
      include: baseTaskInclude(),
      orderBy: { createdAt: "desc" },
    });

    return results;
  } catch (error) {
    logger.error("error fetching getUnassignedTasks", error);
    return [];
  }
}

export async function getUrgentTasks(projectId: string = "", userId: string) {
  try {
    console.log("getUrgentTasks");

    const where: any = {
      isTrash: false,
      priority: "urgent",
    };

    if (projectId) where.projectId = projectId;

    const results = await prisma.task.findMany({
      where,
      include: baseTaskInclude(),
      orderBy: { createdAt: "desc" },
    });

    return results;
  } catch (error) {
    logger.error("error fetching getUrgentTasks", error);
    return [];
  }
}

export async function getLowTasks(projectId: string = "", userId: string) {
  try {
    console.log("getLowTasks");

    const where: any = {
      isTrash: false,
      priority: "low",
    };

    if (projectId) where.projectId = projectId;

    const results = await prisma.task.findMany({
      where,
      include: baseTaskInclude(),
      orderBy: { createdAt: "desc" },
    });

    return results;
  } catch (error) {
    logger.error("error fetching getLowTasks", error);
    return [];
  }
}

export async function getMediumTasks(projectId: string = "", userId: string) {
  try {
    console.log("getMediumTasks");

    const where: any = {
      isTrash: false,
      priority: "medium",
    };

    if (projectId) where.projectId = projectId;

    const results = await prisma.task.findMany({
      where,
      include: baseTaskInclude(),
      orderBy: { createdAt: "desc" },
    });

    return results;
  } catch (error) {
    logger.error("error fetching getMediumTasks", error);
    return [];
  }
}
