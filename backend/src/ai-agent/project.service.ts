import "dotenv/config";
import logger from "vico-logger";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
      include: {
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
          qa: tasks.filter((t) => t.status === "qa").length,
          deploy: tasks.filter((t) => t.status === "deploy").length,
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
    taskAssignees: {
      include: {
        member: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            photo: true,
            phone: true,
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
    comments: true,
  };
}


function buildTaskWhere(projectId?: string, status?: string) {
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
export async function getAllTasks(projectId = "") {
  try {
    console.log("getAllTasks");

    const results = await prisma.task.findMany({
      where: await buildTaskWhere(projectId),
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
export async function getTodoTasks(projectId = "") {
  try {
    console.log("getTodoTasks");

    const results = await prisma.task.findMany({
      where: await buildTaskWhere(projectId, "todo"),
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
export async function getInProgressTasks(projectId = "") {
  try {
    console.log("getInProgressTasks");

    const results = await prisma.task.findMany({
      where: await buildTaskWhere(projectId, "inprogress"),
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
 * QA TASKS
 * =====================================
 */
export async function getQaTasks(projectId = "") {
  try {
    console.log("getQaTasks");

    const results = await prisma.task.findMany({
      where: await buildTaskWhere(projectId, "qa"),
      include: baseTaskInclude(),
      orderBy: { createdAt: "desc" },
    });

    return results;
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
      include: baseTaskInclude(),
      orderBy: { createdAt: "desc" },
    });

    return results;
  } catch (error) {
    logger.error("error fetching getDeployTasks", error);
    return [];
  }
}

/**
 * =====================================
 * DONE TASKS
 * =====================================
 */
export async function getDoneTasks(projectId = "") {
  try {
    console.log("getDoneTasks");

    const results = await prisma.task.findMany({
      where: await buildTaskWhere(projectId, "done"),
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
export async function getMembers(workspaceId: string) {
  try {
    console.log("getMembers");

    const results = await prisma.teamMember.findMany({
      where: { isTrash: false, workspaceId },
      include: {
        taskAssignees: {
          where: {
            task: { isTrash: false }
          },
          include: {
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


    const enriched = results.map((member) => {
      // ambil task dari pivot
      const tasks = member.taskAssignees
        .map((ta) => ta.task)
        .filter(Boolean); // safety

      return {
        id: member.id,
        clientId: member.clientId,
        name: member.name,
        role: member.role,
        email: member.email,
        phone: member.phone,
        photo: member.photo,

        stats: {
          total: tasks.length,
          todo: tasks.filter((t) => t.status === "todo").length,
          inprogress: tasks.filter((t) => t.status === "inprogress").length,
          qa: tasks.filter((t) => t.status === "qa").length,
          deploy: tasks.filter((t) => t.status === "deploy").length,
          done: tasks.filter((t) => t.status === "done").length,
        },

        tasks,
      };
    });


    return enriched;
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
      include: baseTaskInclude(),
      orderBy: { createdAt: "desc" },
    });

    return results;
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
      include: baseTaskInclude(),
      orderBy: { createdAt: "desc" },
    });

    return results;
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
      include: baseTaskInclude(),
      orderBy: { createdAt: "desc" },
    });

    return results;
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
      include: baseTaskInclude(),
      orderBy: { createdAt: "desc" },
    });

    return results;
  } catch (error) {
    logger.error("error fetching getMediumTasks", error);
    return [];
  }
}
