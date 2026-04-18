/* eslint-disable @typescript-eslint/no-base-to-string */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as ExcelJS from "exceljs";
import * as fs from "fs";
import { Prisma } from "@prisma/client";
import { hashPassword } from "src/auth/utils";
import { EmailService } from "src/email/email.service";
import { ActivityLogService } from "src/activity-log/activity-log.service";
import logger from "vico-logger";
import {
  endOfDay,
  parseDateSafe,
  safeDate,
  startOfDay,
} from "src/helpers/safeDate";

const prisma = new PrismaClient();

const FE_URL = process.env?.FE_URL ?? "";

@Injectable()
export class ProjectManagementService {
  constructor(
    private email: EmailService,
    private activityLog: ActivityLogService,
  ) {}
  async getWorkspaces(userId) {
    const members = await prisma.teamMember.findMany({
      where: { isTrash: false, userId },
      orderBy: { createdAt: "asc" },
    });

    const workspaces = await prisma.workspace.findMany({
      where: {
        isTrash: false,
        id: {
          in: members.map((item: any) => item.workspaceId),
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return workspaces;
  }

  // state
  async getState(workspaceId) {
    const projects = await prisma.project.findMany({
      where: { isTrash: false, workspaceId },
      orderBy: { createdAt: "desc" },
    });

    const tasks = await prisma.task.findMany({
      where: {
        isTrash: false,
        projectId: {
          in: projects.map((item: any) => item.id),
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        comments: {
          where: { isTrash: false },
          orderBy: { createdAt: "desc" },
        },
        taskAssignees: {
          include: {
            member: true,
          },
        },
      },
    });

    const team = await prisma.teamMember.findMany({
      where: {
        isTrash: false,
        workspaceId,
      },
      orderBy: { name: "asc" },
    });

    return {
      projects: projects.map((p) => ({
        ...p,
        createdAt: p.createdAt?.toISOString(),
        updatedAt: p.updatedAt?.toISOString(),
      })),
      tasks: tasks.map((t) => ({
        ...t,
        createdAt: t.createdAt?.toISOString(),
        updatedAt: t.updatedAt?.toISOString(),
        comments: (t.comments || []).map((c) => ({
          ...c,
          createdAt: c.createdAt?.toISOString(),
          updatedAt: c.updatedAt?.toISOString(),
        })),
        taskAssignees: t.taskAssignees.map((a) => ({
          id: a.member.id,
          name: a.member.name,
          photo: a.member.photo,
          phone: a.member.phone,
          role: a.member.role,
        })),
      })),
      team: team.map((m) => ({ ...m })),
    };
  }

  // Workspaces

  async createWorkspaces(
    payload: {
      name: string;
      description?: string | null;
      clientId?: string | null;
    },
    userId,
  ) {
    // optional idempotency by clientId (if you add unique constraint later)
    if (payload.clientId) {
      const existing = await prisma.workspace.findFirst({
        where: { clientId: payload.clientId },
      });
      if (existing) return existing;
    }

    const p = await prisma.workspace.create({
      data: {
        name: payload.name ?? "Untitled",
        description: payload.description ?? null,
        clientId: payload.clientId ?? null,
      },
    });

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
    });
    if (user) {
      const createTeam = await prisma.teamMember.create({
        data: {
          clientId: payload.clientId ?? null,
          userId,
          workspaceId: p.id,
          name: user?.name ?? "",
          email: user?.email ?? null,
          phone: user?.phone ?? null,
          photo: user.photo ?? null,
          isAdmin: true,
        },
      });
    }
    return p;
  }

  // Projects
  async getProjects(workspaceId) {
    const projects = await prisma.project.findMany({
      where: {
        isTrash: false,
        workspaceId,
      },
      orderBy: { createdAt: "desc" },
    });
    return projects;
  }

  async createProject(payload: {
    name: string;
    description?: string;
    clientId?: string | null;
    workspaceId: string;
  }) {
    // optional idempotency by clientId (if you add unique constraint later)
    if (payload.clientId) {
      const existing = await prisma.project.findFirst({
        where: { clientId: payload.clientId },
      });
      if (existing) return existing;
    }

    const p = await prisma.project.create({
      data: {
        name: payload.name ?? "Untitled",
        description: payload.description ?? null,
        clientId: payload.clientId ?? null,
        workspaceId: payload.workspaceId ?? null,
      },
    });

    //send email to team members
    const teams = await prisma.teamMember.findMany({
      where: { workspaceId: payload.workspaceId, isTrash: false },
      select: { email: true },
    });

    const toEmails = teams.map((t) => t.email?.trim()).filter(Boolean);

    if (toEmails.length === 0) throw new Error("No recipient emails found");

    const projectName = p.name;
    const projectDesc = p.description ?? "No description provided.";

    const textMsg = `
      A new project has been created on CommitFlow

      Project Name:
      ${projectName}

      Description:
      ${projectDesc}

      You are receiving this notification because you are part of the workspace team.

      Regards,
      CommitFlow Team
    `;

    const htmlMsg = `
    <div style="font-family: Arial, sans-serif; background:#f4f5f7; padding:24px;">
      <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:10px; padding:32px; box-shadow:0 4px 12px rgba(0,0,0,0.05);">

        <h2 style="color:#2d3748; margin:0 0 8px; font-size:22px;">
          🚀 New Project Created
        </h2>

        <p style="color:#4a5568; margin:0 0 20px; font-size:15px;">
          A new project has been created in your <strong>CommitFlow</strong> workspace.
        </p>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:20px; margin-bottom:24px;">
          <p style="margin:0 0 14px; font-size:15px; color:#1a202c;">
            <strong style="color:#2b6cb0;">Project Name:</strong><br>
            ${projectName}
          </p>

          <p style="margin:0; font-size:15px; color:#1a202c;">
            <strong style="color:#2b6cb0;">Description:</strong><br>
            ${projectDesc}
          </p>
        </div>

        <p style="font-size:14px; color:#4a5568; margin-bottom:32px;">
          You are receiving this email because you are a member of this workspace.
        </p>

        <div style="text-align:center; margin-bottom:10px;">
          <a href="${FE_URL}"
            style="background:#2b6cb0; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none; font-size:14px;">
            Open CommitFlow
          </a>
        </div>

        <p style="font-size:13px; color:#a0aec0; text-align:center; margin-top:20px;">
          — CommitFlow Team
        </p>

      </div>
    </div>
  `;

    for (const recipient of toEmails) {
      try {
        await this.email.sendMail({
          to: recipient ?? "",
          subject: "🚀 New Project Created | CommitFlow",
          text: textMsg,
          html: htmlMsg,
        });
      } catch (error) {
        logger.error(error);
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    this.activityLog
      .log({
        workspaceId: payload.workspaceId,
        action: "project.created",
        entity: "project",
        entityId: p.id,
        entityName: p.name,
      })
      .catch(() => {});

    return p;
  }

  async updateProject(
    id: string,
    payload: Partial<{ name: string; description?: string }>,
  ) {
    const exists = await prisma.project.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Project not found");

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...payload,
        updatedAt: new Date(),
      },
    });
    return updated;
  }

  async deleteProject(id: string) {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return { success: false, deleted: false };

    // instead of deleting tasks, we mark them as trashed
    await prisma.$transaction([
      prisma.task.updateMany({
        where: { projectId: id },
        data: { isTrash: true },
      }),
      prisma.project.update({
        where: { id },
        data: { isTrash: true },
      }),
    ]);

    if (project.workspaceId) {
      this.activityLog
        .log({
          workspaceId: project.workspaceId,
          action: "project.deleted",
          entity: "project",
          entityId: id,
          entityName: project.name,
        })
        .catch(() => {});
    }

    return { success: true, deleted: true };
  }

  // Tasks
  async getTasks(projectId?: string, startDate?: string, endDate?: string) {
    await this.migrateSingleAssigneeToMulti();

    const now = new Date();

    // 🔥 DEFAULT RANGE: last 60 days
    const defaultStart = new Date();
    defaultStart.setDate(now.getDate() - 60);

    // 🔥 DEFAULT END: tomorrow (to handle timezone differences)
    const defaultEnd = new Date();
    defaultEnd.setDate(now.getDate() + 1);

    const start = startDate
      ? startOfDay(safeDate(startDate)!)
      : startOfDay(defaultStart);

    const end = endDate ? endOfDay(safeDate(endDate)!) : endOfDay(defaultEnd);

    const where: any = {
      isTrash: false,
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    if (projectId) {
      where.projectId = projectId;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        comments: {
          where: { isTrash: false },
          orderBy: { createdAt: "desc" },
        },
        taskAssignees: {
          include: {
            member: true,
          },
        },
      },
    });

    return tasks.map((t) => ({
      ...t,
      createdAt: t.createdAt?.toISOString(),
      updatedAt: t.updatedAt?.toISOString(),
      comments: (t.comments || []).map((c) => ({
        ...c,
        createdAt: c.createdAt?.toISOString(),
        updatedAt: c.updatedAt?.toISOString(),
      })),
      taskAssignees: t.taskAssignees.map((a) => ({
        id: a.member.id,
        name: a.member.name,
        photo: a.member.photo,
        phone: a.member.phone,
        role: a.member.role,
      })),
    }));
  }

  // Tasks
  async getMyTasks(
    memberId?: string,
    workspaceId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const now = new Date();

    // default: 60 hari terakhir
    const defaultStart = new Date();
    defaultStart.setDate(now.getDate() - 60);

    // default end besok (untuk memastikan task hari ini selalu terfilter)
    const defaultEnd = new Date();
    defaultEnd.setDate(now.getDate() + 1);

    const start = safeDate(startDate);
    const end = safeDate(endDate);

    const createdAtFilter =
      start || end
        ? {
            ...(start && { gte: startOfDay(start) }),
            ...(end && { lte: endOfDay(end) }),
          }
        : {
            gte: startOfDay(defaultStart),
            lte: endOfDay(defaultEnd),
          };

    const where = {
      isTrash: false,
      createdAt: createdAtFilter,

      ...(workspaceId && {
        project: {
          workspaceId,
        },
      }),

      ...(memberId && {
        taskAssignees: {
          some: { memberId },
        },
      }),
    };

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        {
          project: {
            name: "asc", // urutkan berdasarkan nama project
          },
        },
        {
          createdAt: "desc", // lalu task terbaru
        },
      ],
      include: {
        comments: {
          where: { isTrash: false },
          orderBy: { createdAt: "desc" },
        },
        taskAssignees: {
          include: { member: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    return tasks.map((t) => ({
      ...t,
      createdAt: t.createdAt?.toISOString(),
      updatedAt: t.updatedAt?.toISOString(),
      comments: (t.comments || []).map((c) => ({
        ...c,
        createdAt: c.createdAt?.toISOString(),
        updatedAt: c.updatedAt?.toISOString(),
      })),
      project: t.project
        ? {
            id: t.project.id,
            name: t.project.name,
          }
        : null,
      taskAssignees: t.taskAssignees.map((a) => ({
        id: a.member.id,
        name: a.member.name,
        photo: a.member.photo,
        phone: a.member.phone,
        role: a.member.role,
      })),
    }));
  }

  // Tasks Workspace
  async getTasksWorkspace(
    workspaceId?: string,
    memberId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const now = new Date();

    // default 60 days
    const defaultStart = new Date();
    defaultStart.setDate(now.getDate() - 60);

    // default end tomorrow (to ensure today's tasks are always included)
    const defaultEnd = new Date();
    defaultEnd.setDate(now.getDate() + 1);

    const parsedStart = parseDateSafe(startDate);
    const parsedEnd = parseDateSafe(endDate);

    const start = parsedStart
      ? startOfDay(parsedStart)
      : startOfDay(defaultStart);

    const end = parsedEnd ? endOfDay(parsedEnd) : endOfDay(defaultEnd);

    const safeMemberId =
      memberId && memberId !== "undefined" && memberId !== "null"
        ? memberId
        : undefined;

    const where: any = {
      isTrash: false,
      createdAt: {
        gte: start,
        lte: end,
      },
      project: {
        workspaceId,
      },
      ...(safeMemberId && {
        taskAssignees: {
          some: { memberId: safeMemberId },
        },
      }),
    };

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        {
          project: {
            name: "asc", // urutkan berdasarkan nama project
          },
        },
        {
          createdAt: "desc", // lalu task terbaru
        },
      ],
      include: {
        comments: {
          where: { isTrash: false },
          orderBy: { createdAt: "desc" },
        },
        taskAssignees: {
          include: {
            member: true,
          },
        },
        project: true,
      },
    });

    return tasks.map((t) => ({
      ...t,
      createdAt: t.createdAt?.toISOString(),
      updatedAt: t.updatedAt?.toISOString(),
      comments: (t.comments || []).map((c) => ({
        ...c,
        createdAt: c.createdAt?.toISOString(),
        updatedAt: c.updatedAt?.toISOString(),
      })),
      taskAssignees: t.taskAssignees.map((a) => ({
        id: a.member.id,
        name: a.member.name,
        photo: a.member.photo,
        phone: a.member.phone,
        role: a.member.role,
      })),
    }));
  }

  // one time migration task assignee
  async migrateSingleAssigneeToMulti() {
    // 1️⃣ cek apakah taskAssignee sudah ada data
    const existingCount = await prisma.taskAssignee.count();

    if (existingCount > 0) {
      return { skipped: true, reason: "already_migrated" };
    }

    // 2️⃣ ambil task yang punya assigneeId
    const tasksWithAssignee = await prisma.task.findMany({
      where: {
        assigneeId: { not: null },
        isTrash: false,
      },
      select: {
        id: true,
        assigneeId: true,
        createdAt: true,
      },
    });

    if (tasksWithAssignee.length === 0) {
      console.log("[MIGRATION] No tasks with assigneeId found.");
      return { skipped: true, reason: "no_legacy_assignee" };
    }

    // 3️⃣ migrate
    const data = tasksWithAssignee.map((t) => ({
      taskId: t.id,
      memberId: t.assigneeId!,
      assignedAt: t.createdAt ?? new Date(),
    }));

    await prisma.taskAssignee.createMany({
      data,
      skipDuplicates: true,
    });

    console.log(`[MIGRATION] Migrated ${data.length} tasks into TaskAssignee`);

    return {
      migrated: data.length,
    };
  }

  // ------------------------------------------
  // Updated createTask / updateTask / patchTask
  // ------------------------------------------
  async createTask(
    payload: Partial<{
      title: string;
      description?: string;
      projectId?: string | null;
      status?: string;
      priority?: string | null;
      taskAssignees?: { memberId: string }[];
      startDate?: string | null;
      dueDate?: string | null;
      clientId?: string | null;
      createdById?: string | null;
      updatedById?: string | null;
    }>,
  ) {
    // --------------------------------
    // VALIDATE PROJECT
    // --------------------------------
    if (payload.projectId) {
      const p = await prisma.project.findUnique({
        where: { id: payload.projectId },
      });
      if (!p) throw new NotFoundException("Project not found");
    }

    // --------------------------------
    // IDEMPOTENCY CHECK
    // --------------------------------
    if (payload.clientId) {
      const existing = await prisma.task.findFirst({
        where: { clientId: payload.clientId },
        include: {
          taskAssignees: { include: { member: true } },
        },
      });
      if (existing) {
        return {
          ...existing,
          createdAt: existing.createdAt?.toISOString(),
          updatedAt: existing.updatedAt?.toISOString(),
        };
      }
    }

    // --------------------------------
    // VALIDATE ASSIGNEES (MULTI)
    // --------------------------------
    let assigneeIds: string[] = [];

    if (payload.taskAssignees?.length) {
      assigneeIds = payload.taskAssignees.map((a) => a.memberId);

      const members = await prisma.teamMember.findMany({
        where: { id: { in: assigneeIds } },
      });

      if (members.length !== assigneeIds.length) {
        throw new BadRequestException("One or more assignees not found");
      }
    }

    // --------------------------------
    // CREATE TASK + ASSIGNEES (ATOMIC)
    // --------------------------------
    const task = await prisma.$transaction(async (tx) => {
      const t = await tx.task.create({
        data: {
          title: payload.title ?? "Untitled Task",
          description: payload.description ?? null,
          projectId: payload.projectId ?? null,
          status: payload.status ?? "todo",
          priority: payload.priority ?? null,
          startDate: payload.startDate !== undefined ? payload.startDate : null,
          dueDate: payload.dueDate !== undefined ? payload.dueDate : null,
          clientId: payload.clientId ?? null,
          createdById: payload.createdById ?? null,
        },
      });

      if (assigneeIds.length) {
        await tx.taskAssignee.createMany({
          data: assigneeIds.map((memberId) => ({
            taskId: t.id,
            memberId,
          })),
          skipDuplicates: true,
        });
      }

      return t;
    });

    // --------------------------------
    // RETURN SERIALIZED TASK
    // --------------------------------
    if (task.projectId) {
      const proj = await prisma.project.findUnique({
        where: { id: task.projectId },
      });
      if (proj?.workspaceId) {
        this.activityLog
          .log({
            workspaceId: proj.workspaceId,
            memberId: payload.createdById ?? undefined,
            action: "task.created",
            entity: "task",
            entityId: task.id,
            entityName: task.title,
          })
          .catch(() => {});
      }
    }

    return {
      ...task,
      createdAt: task.createdAt?.toISOString(),
      updatedAt: task.updatedAt?.toISOString(),
    };
  }

  async updateTask(
    id: string,
    payload: Partial<{
      title?: string;
      description?: string;
      projectId?: string | null;
      status?: string;
      priority?: string | null;
      taskAssignees?: { memberId: string }[];
      startDate?: string | null;
      dueDate?: string | null;
      createdById?: string | null;
      updatedById?: string | null;
    }>,
    userId: string,
  ) {
    const existing = await prisma.task.findUnique({
      where: { id },
      include: {
        taskAssignees: { include: { member: true } },
      },
    });
    if (!existing) throw new NotFoundException("Task not found");

    const prevAssignees = existing.taskAssignees;
    const prevAssigneeIds = prevAssignees.map((a) => a.memberId);

    // -----------------------------
    // VALIDATE PROJECT
    // -----------------------------
    let project: any = null;
    if (payload.projectId !== undefined && payload.projectId !== null) {
      project = await prisma.project.findUnique({
        where: { id: payload.projectId },
      });
      if (!project) throw new NotFoundException("Project not found");
    } else if (existing.projectId) {
      project = await prisma.project.findUnique({
        where: { id: existing.projectId },
      });
    }

    // -----------------------------
    // VALIDATE ASSIGNEES
    // -----------------------------
    let nextAssigneeIds: string[] = prevAssigneeIds;

    if (payload.taskAssignees) {
      nextAssigneeIds = payload.taskAssignees.map((a) => a.memberId);

      const members = await prisma.teamMember.findMany({
        where: { id: { in: nextAssigneeIds } },
      });

      if (members.length !== nextAssigneeIds.length) {
        throw new BadRequestException("One or more assignees not found");
      }
    }

    let finishDateUpdate: Date | null | undefined = undefined;
    const nextStatus = payload.status ?? existing.status;

    if (nextStatus === "done" && existing.status !== "done") {
      // baru saja selesai
      finishDateUpdate = new Date();
    }

    if (nextStatus !== "done" && existing.status === "done") {
      // batal selesai
      finishDateUpdate = null;
    }

    // -----------------------------
    // UPDATE TASK CORE FIELDS
    // -----------------------------
    const updated = await prisma.task.update({
      where: { id },
      data: {
        title: payload.title ?? existing.title,
        description: payload.description ?? existing.description,

        projectId:
          payload.projectId !== undefined
            ? payload.projectId
            : existing.projectId,

        status: nextStatus,

        finishDate: finishDateUpdate,

        priority: payload.priority ?? existing.priority,

        startDate:
          payload.startDate !== undefined
            ? payload.startDate
            : existing.startDate,

        dueDate:
          payload.dueDate !== undefined ? payload.dueDate : existing.dueDate,

        updatedAt: new Date(),

        updatedById: payload.updatedById,
      },
    });

    // -----------------------------
    // SYNC TASK ASSIGNEES (REPLACE)
    // -----------------------------
    if (payload.taskAssignees) {
      await prisma.$transaction([
        prisma.taskAssignee.deleteMany({ where: { taskId: id } }),
        prisma.taskAssignee.createMany({
          data: nextAssigneeIds.map((memberId) => ({
            taskId: id,
            memberId,
          })),
        }),
      ]);
    }

    // -----------------------------
    // EMAIL TARGET
    // -----------------------------
    const assigneeNames = payload.taskAssignees
      ? (
          await prisma.teamMember.findMany({
            where: { id: { in: nextAssigneeIds } },
          })
        )
          .map((m) => m.name)
          .join(", ")
      : prevAssignees.map((a) => a.member.name).join(", ");

    const teams = await prisma.teamMember.findMany({
      where: {
        workspaceId: project?.workspaceId,
        isTrash: false,
        OR: [
          { isAdmin: true },
          { id: { in: nextAssigneeIds } },
          { id: existing.createdById ?? "" },
        ],
      },
      select: { email: true },
    });

    const toEmails: any = Array.from(
      new Set(teams.map((t) => t.email?.trim().toLowerCase()).filter(Boolean)),
    );

    if (!toEmails.length) return updated;

    // -----------------------------
    // EMAIL CONTENT
    // -----------------------------
    const format = (d: any) =>
      d ? new Date(d).toLocaleDateString("en-US") : "—";

    const emailTitle = `📝 Task Updated`;
    const emailDescription = `📝 A task has been updated on <strong>${project?.name}</strong>.`;

    const textMsg = `
${emailDescription}

Task: ${updated.title}
Status: ${updated.status}
Assignees: ${assigneeNames}
Priority: ${updated.priority ?? "—"}
Start Date: ${format(updated.startDate)}
Due Date: ${format(updated.dueDate)}

— CommitFlow Team
`;

    const htmlMsg = `
<p><strong>${emailDescription}</strong></p>
<p><b>Task:</b> ${updated.title}</p>
<p><b>Status:</b> ${updated.status}</p>
<p><b>Assignees:</b> ${assigneeNames}</p>
<p><b>Priority:</b> ${updated.priority ?? "—"}</p>
<p><b>Start:</b> ${format(updated.startDate)}</p>
<p><b>Due:</b> ${format(updated.dueDate)}</p>
`;

    for (const recipient of toEmails) {
      await this.email.sendMail({
        to: recipient ?? "",
        subject: `${emailTitle} | CommitFlow`,
        text: textMsg,
        html: htmlMsg,
      });
    }

    // -----------------------------
    // RETURN UPDATED TASK
    // -----------------------------
    const withComments = await prisma.task.findUnique({
      where: { id },
      include: {
        comments: {
          where: { isTrash: false },
          orderBy: { createdAt: "desc" },
        },
        taskAssignees: { include: { member: true } },
      },
    });

    // Activity log for task updates
    if (updated.projectId) {
      const proj = await prisma.project.findUnique({
        where: { id: updated.projectId },
      });
      if (proj?.workspaceId) {
        const changes: Record<string, any> = {};
        if (payload.status && payload.status !== existing.status) {
          changes.from = existing.status;
          changes.to = payload.status;
        }
        if (payload.title && payload.title !== existing.title) {
          changes.oldTitle = existing.title;
          changes.newTitle = payload.title;
        }
        this.activityLog
          .log({
            workspaceId: proj.workspaceId,
            memberId: payload.updatedById ?? userId ?? undefined,
            action:
              payload.status && payload.status !== existing.status
                ? "task.status_changed"
                : "task.updated",
            entity: "task",
            entityId: id,
            entityName: updated.title,
            meta: Object.keys(changes).length ? changes : undefined,
          })
          .catch(() => {});
      }
    }

    return {
      ...withComments,
      createdAt: withComments?.createdAt?.toISOString(),
      updatedAt: withComments?.updatedAt?.toISOString(),
    };
  }

  async patchTask(
    id: string,
    patch: Partial<{
      title?: string;
      description?: string;
      projectId?: string | null;
      status?: string;
      priority?: string | null;
      taskAssignees?: { memberId: string; role?: string }[];
      startDate?: string | null;
      dueDate?: string | null;
      createdById?: string | null;
      updatedById?: string | null;
    }>,
    userId: string,
  ) {
    // reuse updateTask logic (keeps validations & logging)
    return this.updateTask(id, patch, userId);
  }

  async deleteTask(id: string) {
    // delete comments associated then delete task
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return { success: false, deleted: false };

    await prisma.$transaction([
      prisma.comment.updateMany({
        where: { taskId: id },
        data: { isTrash: true },
      }),
      prisma.task.update({
        where: { id },
        data: { isTrash: true },
      }),
    ]);

    if (task.projectId) {
      const proj = await prisma.project.findUnique({
        where: { id: task.projectId },
      });
      if (proj?.workspaceId) {
        this.activityLog
          .log({
            workspaceId: proj.workspaceId,
            action: "task.deleted",
            entity: "task",
            entityId: id,
            entityName: task.title,
          })
          .catch(() => {});
      }
    }

    return { success: true, deleted: true };
  }

  // Comments
  async getComments(taskId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException("Task not found");
    const comments = await prisma.comment.findMany({
      where: { taskId, isTrash: false },
      orderBy: { createdAt: "desc" },
    });
    return comments;
  }

  async createComment(
    taskId: string,
    payload: {
      author: string;
      body: string;
      memberId: string;
      attachments?: any[];
    },
  ) {
    // -----------------------------
    // GET TASK + ASSIGNEES
    // -----------------------------
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        taskAssignees: {
          select: { memberId: true },
        },
      },
    });
    if (!task) throw new NotFoundException("Task not found");

    // -----------------------------
    // CREATE COMMENT
    // -----------------------------
    const c = await prisma.comment.create({
      data: {
        taskId,
        author: payload.author,
        memberId: payload.memberId,
        body: payload.body,
        attachments: payload.attachments ?? undefined,
      },
    });

    //update task
    const updateTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        updatedById: payload.memberId,
        updatedAt: new Date(),
      },
    });
    // -----------------------------
    // GET PROJECT
    // -----------------------------
    const project: any = await prisma.project.findFirst({
      where: { id: task.projectId ?? "", isTrash: false },
    });
    if (!project) throw new NotFoundException("Project not found");

    // -----------------------------
    // RESOLVE EMAIL RECIPIENTS
    // -----------------------------
    const assigneeIds = task.taskAssignees.map((a) => a.memberId);

    const teams = await prisma.teamMember.findMany({
      where: {
        workspaceId: project.workspaceId,
        isTrash: false,
        OR: [
          { isAdmin: true },
          ...(assigneeIds.length ? [{ id: { in: assigneeIds } }] : []),
          ...(task.createdById ? [{ id: task.createdById }] : []),
        ],
      },
      select: { email: true },
    });

    const toEmails = Array.from(
      new Set(teams.map((t) => t.email?.trim().toLowerCase()).filter(Boolean)),
    );

    if (!toEmails.length) {
      return {
        ...c,
        createdAt: c.createdAt?.toISOString(),
        updatedAt: c.updatedAt?.toISOString(),
      };
    }

    // -----------------------------
    // EMAIL CONTENT
    // -----------------------------
    const projectName = project.name;
    const taskName = task.title;
    const author = payload.author;
    const body = payload.body;

    const textMsg = `
💬 New Comment!

Project:
${projectName}

Task:
${taskName}

Author:
${author}

Comment:
${body}

— CommitFlow Team
`;

    const htmlMsg = `
<div style="font-family: Arial, sans-serif; background:#f4f5f7; padding:24px;">
  <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:10px; padding:28px; box-shadow:0 6px 20px rgba(13,38,59,0.06);">

    <h2 style="color:#2d3748;">💬 New Comment</h2>

    <p><strong>Project:</strong><br>${projectName}</p>
    <p><strong>Task:</strong><br>${taskName}</p>
    <p><strong>Author:</strong><br>${author}</p>

    <div style="margin-top:12px; padding:14px; background:#f8fafc; border-radius:8px;">
      <strong>Comment</strong>
      <p style="white-space:pre-wrap;">
        ${body && body.length > 300 ? body.slice(0, 300) + "…" : body}
      </p>
    </div>

    <div style="text-align:center; margin-top:20px;">
      <a href="${FE_URL}"
        style="background:#2b6cb0; color:#fff; padding:12px 18px; border-radius:6px; text-decoration:none;">
        Open in CommitFlow
      </a>
    </div>

  </div>
</div>
`;

    // -----------------------------
    // SEND EMAIL
    // -----------------------------
    for (const recipient of toEmails) {
      try {
        await this.email.sendMail({
          to: recipient ?? "",
          subject: "💬 New Comment | CommitFlow",
          text: textMsg,
          html: htmlMsg,
        });
      } catch (err) {
        logger.error(err);
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    return {
      ...c,
      createdAt: c.createdAt?.toISOString(),
      updatedAt: c.updatedAt?.toISOString(),
    };
  }

  async updateComment(
    taskId: string,
    commentId: string,
    patch: Partial<{ body?: string; attachments?: any[] }>,
  ) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.taskId !== taskId)
      throw new NotFoundException("Comment not found");

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        ...patch,
      },
    });
    return updated;
  }

  async deleteComment(taskId: string, commentId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.taskId !== taskId)
      return { success: false, deleted: false };
    await prisma.comment.update({
      where: { id: commentId },
      data: { isTrash: true },
    });
    return { success: true, deleted: true };
  }

  // Team
  async getTeam(workspaceId) {
    return await prisma.teamMember.findMany({
      where: {
        isTrash: false,
        workspaceId,
      },
      orderBy: { name: "asc" },
    });
  }

  async createTeamMember(
    payload: Partial<{
      name: string;
      role?: string;
      email?: string;
      photo?: string;
      phone?: string;
      isAdmin?: boolean;
      password?: string;
      clientId?: string | null;
      workspaceId: string;
    }>,
  ) {
    const {
      clientId,
      email,
      name,
      role,
      photo,
      phone,
      isAdmin,
      password,
      workspaceId,
    } = payload as any;

    // 1) If clientId provided — try to find existing TeamMember by clientId first.
    if (clientId) {
      const existing = await prisma.teamMember.findFirst({
        where: { clientId, workspaceId },
      });
      if (existing) {
        return { teamMember: existing };
      }
    }

    // 2) Otherwise create both inside a transaction (atomic)
    try {
      const result = await prisma.$transaction(async (tx) => {
        //check user
        let user: any = null;
        const existingUser = await prisma.user.findFirst({
          where: { email },
        });
        if (existingUser) {
          user = existingUser;
        }

        if (!user) {
          // create user
          const hashed = password ? hashPassword(password) : undefined;
          user = await tx.user.create({
            data: {
              name: name ?? "Unnamed",
              email: email ?? null,
              password: hashed ?? null,
              phone: phone ?? null,
              photo: photo ?? null,
            },
          });
        }

        // create team member
        const tm = await tx.teamMember.create({
          data: {
            name: user.name ?? "Unnamed",
            role: role ?? null,
            email: user.email ?? null,
            photo: user.photo ? user.photo : (photo ?? null),
            phone: phone ?? null,
            clientId: clientId ?? null,
            isAdmin: isAdmin ?? false,
            userId: user.id,
            workspaceId,
            createdAt: new Date(),
          },
        });

        return { tm, user };
      });

      this.activityLog
        .log({
          workspaceId,
          action: "member.added",
          entity: "member",
          entityId: result.tm.id,
          entityName: result.tm.name,
        })
        .catch(() => {});

      return { teamMember: result.tm, user: result.user };
    } catch (err: any) {
      // Prisma unique constraint code P2002 — surface a friendly error
      if (err?.code === "P2002") {
        // you may inspect err.meta.target to know which field caused conflict
        throw new ConflictException(
          "Unique constraint failed (email or clientId)",
        );
      }
      console.error("createTeamMember transaction error", err);
      throw new InternalServerErrorException("Failed to create member");
    }
  }

  async updateTeamMember(
    id: string,
    payload: Partial<{
      name?: string;
      role?: string;
      phone?: string;
      password?: string;
      isAdmin?: boolean;
      photo?: string;
    }>,
  ) {
    // 1) ensure team member exists
    const exists = await prisma.teamMember.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Team member not found");

    // prepare sanitized data for teamMember update (only fields we want)
    const tmData: any = {};
    if (typeof payload.name !== "undefined") tmData.name = payload.name;
    if (typeof payload.role !== "undefined") tmData.role = payload.role;
    if (typeof payload.phone !== "undefined") tmData.phone = payload.phone;
    if (typeof payload.photo !== "undefined") tmData.photo = payload.photo;
    if (typeof payload.isAdmin !== "undefined")
      tmData.isAdmin = payload.isAdmin;
    tmData.updatedAt = new Date();

    // prepare user update/create data
    const userData: any = {};
    if (typeof payload.name !== "undefined") userData.name = payload.name;
    if (typeof payload.phone !== "undefined")
      userData.phone = payload.phone ?? null;
    if (typeof payload.photo !== "undefined")
      userData.photo = payload.photo ?? null;
    // password must be hashed
    if (typeof payload.password !== "undefined" && payload.password !== null) {
      userData.password = hashPassword(payload.password);
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 2) update team member
        const updatedTeam = await tx.teamMember.update({
          where: { id },
          data: tmData,
        });

        // 3) find existing user linked to this teamMember
        let user = await tx.user.findFirst({
          where: { email: updatedTeam.email },
        });

        if (user) {
          // update existing user (only fields present)
          // build patch only if there are fields to update
          const hasUserFields = Object.keys(userData).length > 0;
          if (hasUserFields) {
            user = await tx.user.update({
              where: { id: user.id },
              data: userData,
              include: {
                members: true,
              },
            });
          }
        }

        return { teamMember: updatedTeam, user };
      });

      return result;
    } catch (err: any) {
      // Prisma unique constraint
      if (err?.code === "P2002") {
        // err.meta?.target may indicate which column (e.g. ['email'])
        throw new ConflictException(
          "Unique constraint failed (email or other field)",
        );
      }
      console.error("updateTeamMember error", err);
      throw new InternalServerErrorException("Failed to update team member");
    }
  }

  async deleteTeamMember(id: string) {
    const exists = await prisma.teamMember.findUnique({
      where: { id },
    });
    if (!exists) return { success: false, deleted: false };

    await prisma.$transaction([
      // 1️⃣ hapus semua relasi taskAssignee
      prisma.taskAssignee.deleteMany({
        where: { memberId: id },
      }),

      // 2️⃣ soft delete team member
      prisma.teamMember.update({
        where: { id },
        data: {
          isTrash: true,
          updatedAt: new Date(),
        },
      }),
    ]);

    return { success: true, deleted: true };
  }

  async inviteTeamMember(
    payload: { email: string; workspaceId: string },
    userId: string,
  ) {
    if (!payload.email) throw new NotFoundException("Email invalid");
    if (!payload.workspaceId) throw new NotFoundException("Workspace invalid");
    if (!userId) throw new NotFoundException("User invalid");

    const checkMember = await prisma.teamMember.findFirst({
      where: {
        email: payload.email,
        workspaceId: payload.workspaceId,
      },
    });
    if (checkMember) {
      return {
        success: false,
        reason: "exists",
        message: "Member already exists!",
      };
    }

    const invite = await prisma.invite.create({
      data: {
        workspaceId: payload.workspaceId,
        email: payload.email,
        invitedBy: userId,
      },
    });

    const workspace = await prisma.workspace.findUnique({
      where: {
        id: payload.workspaceId,
      },
    });

    if (!workspace) throw new NotFoundException("Workspace not found");
    const workspaceName = workspace.name;

    const expires = new Date(invite.createdAt);
    expires.setDate(expires.getDate() + 1);

    const expiryTime = expires.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    });

    const textMsg = `
      👋 You’ve been invited to join a workspace on CommitFlow!

          Workspace:
          - ${workspaceName}
    
          Click the link below to accept the invitation:
          ${FE_URL}/?inviteToken=${invite.id}

          Link Expiry: ${expiryTime}

          This link is unique for you. If you didn’t expect this invitation, you can safely ignore this email.

          —
          CommitFlow Team
    `;

    const htmlMsg = `
      <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #333; max-width: 520px; margin: auto;">
        <h2 style="margin-bottom: 10px;">👋 You've been invited to join CommitFlow</h2>

        <p style="font-size: 15px;">
          You have been invited to join the following workspace:
        </p>

        <div style="padding: 16px 20px; background: #f8f9fa; border: 1px solid #e5e5e5; border-radius: 8px; margin: 18px 0;">
          <p style="margin: 0; font-size: 15px;">
            <strong>Workspace:</strong><br>
            ${workspaceName}
          </p>

          <p style="margin: 12px 0 0; font-size: 15px;">
            <strong>Link Expiry:</strong><br>
            ${expiryTime} <!-- contoh: "26 Nov 2025, 14:30 WIB" -->
          </p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${FE_URL}/?inviteToken=${invite.id}"
            style="
              background-color: #4a6cf7;
              color: #ffffff;
              text-decoration: none;
              padding: 12px 22px;
              font-size: 15px;
              font-weight: bold;
              border-radius: 6px;
              display: inline-block;
            ">
            Accept Invitation
          </a>
        </div>

        <p style="font-size: 14px;">
          This link is unique to you and will expire in <strong>24 hours</strong>.  
          If you did not expect this invitation, you may safely ignore this email.
        </p>

        <p style="margin-top: 26px; font-size: 14px; color: #666;">
          — CommitFlow Team
        </p>
      </div>
    `;

    try {
      await this.email.sendMail({
        to: payload.email,
        subject: `👋 You've been invited to join workspace ${workspaceName} | CommitFlow`,
        text: textMsg,
        html: htmlMsg,
      });
    } catch (error) {
      logger.error(error);
    }

    await new Promise((r) => setTimeout(r, 200));

    return {
      success: true,
      message: "Invite success.",
      id: invite.id,
    };
  }

  async acceptInvite(id: string) {
    const exists = await prisma.invite.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Invitation link not found");
    if (exists.isInvited) {
      return {
        success: false,
        reason: "invited",
        message: "User already exists in team",
      };
    }
    // Expiration: 1 day (24 hours)
    const now = new Date();
    const createdAt = new Date(exists.createdAt);
    const diffMs = now.getTime() - createdAt.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (diffMs > oneDayMs) {
      return {
        success: false,
        reason: "expired",
        message: "Invitation link has expired",
      };
    }

    const user = await prisma.user.findUnique({
      where: { email: exists.email },
    });

    // If the email hasn’t registered yet, allow frontend to continue registration
    if (!user) {
      return { success: true, user: null, id };
    }

    // If user exists, add them to the team
    const createTeam = await prisma.teamMember.create({
      data: {
        workspaceId: exists.workspaceId,
        userId: user.id,
        name: user.name ?? "",
        email: user.email,
        phone: user.phone,
        photo: user.photo,
      },
    });

    const updateInvite = await prisma.invite.update({
      where: {
        id,
      },
      data: {
        isInvited: true,
      },
    });

    return { success: true, user };
  }

  // Export XLSX
  async exportXlsx(): Promise<Buffer> {
    const projects = await prisma.project.findMany({
      where: { isTrash: false },
    });

    const tasks = await prisma.task.findMany({
      where: { isTrash: false },
      include: {
        taskAssignees: {
          include: { member: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const team = await prisma.teamMember.findMany({
      where: { isTrash: false },
      orderBy: { name: "asc" },
    });

    const wb = new ExcelJS.Workbook();

    // ---------------- PROJECTS ----------------
    const pSheet = wb.addWorksheet("Projects");
    pSheet.columns = [
      { header: "id", key: "id" },
      { header: "name", key: "name" },
      { header: "description", key: "description" },
      { header: "createdAt", key: "createdAt" },
      { header: "updatedAt", key: "updatedAt" },
    ];

    projects.forEach((p) =>
      pSheet.addRow({
        ...p,
        createdAt: p.createdAt?.toISOString(),
        updatedAt: p.updatedAt?.toISOString(),
      }),
    );

    // ---------------- TASKS ----------------
    const tSheet = wb.addWorksheet("Tasks");
    tSheet.columns = [
      { header: "id", key: "id" },
      { header: "title", key: "title" },
      { header: "description", key: "description" },
      { header: "projectId", key: "projectId" },
      { header: "status", key: "status" },
      { header: "assigneeIds", key: "assigneeIds" },
      { header: "assigneeNames", key: "assigneeNames" },
      { header: "priority", key: "priority" },
      { header: "startDate", key: "startDate" },
      { header: "dueDate", key: "dueDate" },
      { header: "createdAt", key: "createdAt" },
      { header: "updatedAt", key: "updatedAt" },
    ];

    tasks.forEach((t) => {
      const assignees = t.taskAssignees.map((a) => a.member);

      tSheet.addRow({
        id: t.id,
        title: t.title,
        description: t.description,
        projectId: t.projectId,
        status: t.status,
        assigneeIds: assignees.map((a) => a.id).join(","),
        assigneeNames: assignees.map((a) => a.name).join(", "),
        priority: t.priority ?? null,
        startDate: t.startDate ?? null,
        dueDate: t.dueDate ?? null,
        createdAt: t.createdAt?.toISOString(),
        updatedAt: t.updatedAt?.toISOString(),
      });
    });

    // ---------------- TEAM ----------------
    const teamSheet = wb.addWorksheet("Team");
    teamSheet.columns = [
      { header: "id", key: "id" },
      { header: "name", key: "name" },
      { header: "role", key: "role" },
      { header: "email", key: "email" },
      { header: "photo", key: "photo" },
    ];

    team.forEach((m) => teamSheet.addRow(m));

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // Import XLSX
  async importXlsx(filePath: string) {
    if (!fs.existsSync(filePath))
      throw new BadRequestException("File not found");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const created = { projects: 0, tasks: 0, team: 0 };

    // preload team
    const allTeam = await prisma.teamMember.findMany({
      where: { isTrash: false },
    });
    const teamMap = new Map(allTeam.map((m) => [m.id, m]));

    // ---------------- TASKS ----------------
    const tasksSheet = workbook.getWorksheet("Tasks");
    if (tasksSheet) {
      const rows = tasksSheet.getRows(2, tasksSheet.rowCount - 1) ?? [];

      for (const row of rows) {
        const id = row.getCell(1).value?.toString();
        const title = row.getCell(2).value?.toString() ?? "Untitled";
        const description = row.getCell(3).value?.toString() ?? null;
        const projectId = row.getCell(4).value?.toString() ?? null;
        const status = row.getCell(5).value?.toString() ?? "todo";
        const assigneeIdsRaw = row.getCell(6).value?.toString() ?? "";
        const priority = row.getCell(8).value?.toString() ?? null;
        const startDate = row.getCell(9).value?.toString() ?? null;
        const dueDate = row.getCell(10).value?.toString() ?? null;

        const assigneeIds = assigneeIdsRaw
          .split(",")
          .map((s) => s.trim())
          .filter((id) => teamMap.has(id));

        const task = id
          ? await prisma.task.upsert({
              where: { id },
              create: {
                id,
                title,
                description,
                projectId,
                status,
                priority,
                startDate,
                dueDate,
              },
              update: {
                title,
                description,
                projectId,
                status,
                priority,
                startDate,
                dueDate,
                updatedAt: new Date(),
              },
            })
          : await prisma.task.create({
              data: {
                title,
                description,
                projectId,
                status,
                priority,
                startDate,
                dueDate,
              },
            });

        if (assigneeIds.length) {
          await prisma.taskAssignee.createMany({
            data: assigneeIds.map((memberId) => ({
              taskId: task.id,
              memberId,
            })),
            skipDuplicates: true,
          });
        }

        created.tasks++;
      }
    }

    fs.unlinkSync(filePath);
    return { success: true, ...created };
  }
}
