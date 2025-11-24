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
import logger from "vico-logger";

const prisma = new PrismaClient();

@Injectable()
export class ProjectManagementService {
  constructor(private email: EmailService) {}
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
    userId
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
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="margin-bottom: 8px;">🚀 New Project Created</h2>
        <p>A new project has been added to your workspace on <strong>CommitFlow</strong>.</p>

        <div style="padding: 12px 16px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 15px;">
            <strong>Project Name:</strong><br>
            ${projectName}
          </p>

          <p style="margin-top: 12px; font-size: 15px;">
            <strong>Description:</strong><br>
            ${projectDesc}
          </p>
        </div>

        <p>You are receiving this because you are a member of this workspace.</p>

        <p style="margin-top: 24px; font-size: 14px; color: #666;">
          — CommitFlow Team
        </p>
      </div>
    `;

    for (const recipient of toEmails) {
      try {
        await this.email.sendMail({
          to: recipient ?? "getechindonesia@gmail.com",
          subject: "New Project Created | CommitFlow",
          text: textMsg,
          html: htmlMsg,
        });
      } catch (error) {
        logger.error(error);
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    return p;
  }

  async updateProject(
    id: string,
    payload: Partial<{ name: string; description?: string }>
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

    return { success: true, deleted: true };
  }

  // Tasks
  async getTasks(projectId?: string) {
    const where = projectId
      ? { projectId, isTrash: false }
      : { isTrash: false };
    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        comments: {
          where: { isTrash: false },
          orderBy: { createdAt: "desc" },
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
    }));
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
      assigneeId?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
      clientId?: string | null; // optional client-generated id for idempotency
    }>
  ) {
    // quick debug log (remove in production when stable)
    console.log("[createTask] incoming", {
      clientId: payload.clientId,
      projectId: payload.projectId,
      title: payload.title,
      ts: new Date().toISOString(),
    });

    // validate projectId/assignee exist if provided (and not null)
    if (
      typeof payload.projectId !== "undefined" &&
      payload.projectId !== null
    ) {
      const p = await prisma.project.findUnique({
        where: { id: payload.projectId },
      });
      if (!p) throw new NotFoundException("Project not found");
    }
    if (
      typeof payload.assigneeId !== "undefined" &&
      payload.assigneeId !== null
    ) {
      const m = await prisma.teamMember.findUnique({
        where: { id: payload.assigneeId },
      });
      if (!m) throw new NotFoundException("Assignee not found");
    }

    // Defensive idempotency: if clientId provided and server already has it, return existing row
    if (payload.clientId) {
      const existing = await prisma.task.findFirst({
        where: { clientId: payload.clientId },
      });
      if (existing) {
        console.log(
          "[createTask] idempotent hit, returning existing id=",
          existing.id
        );
        return existing;
      }
    }

    // Create task (store startDate/dueDate as strings to match Prisma schema)
    const t = await prisma.task.create({
      data: {
        title: payload.title ?? "Untitled Task",
        description: payload.description ?? null,
        projectId: payload.projectId ?? null,
        status: payload.status ?? "todo",
        priority: payload.priority ?? null,
        assigneeId: payload.assigneeId ?? null,
        startDate:
          typeof payload.startDate === "undefined"
            ? null
            : payload.startDate ?? null,
        dueDate:
          typeof payload.dueDate === "undefined"
            ? null
            : payload.dueDate ?? null,
        clientId: payload.clientId ?? null,
      },
    });

    console.log(
      "[createTask] created id=",
      t.id,
      "clientId=",
      payload.clientId ?? null
    );

    // return serialized created task (timestamps as ISO)
    return {
      ...t,
      createdAt: t.createdAt?.toISOString(),
      updatedAt: t.updatedAt?.toISOString(),
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
      assigneeId?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
    }>,
    userId: string
  ) {
    const exists = await prisma.task.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Task not found");
    let project: any = null;
    // validate projectId if present and not null (null means detach project)
    if (
      typeof payload.projectId !== "undefined" &&
      payload.projectId !== null
    ) {
      project = await prisma.project.findUnique({
        where: { id: payload.projectId },
      });
      if (!project) throw new NotFoundException("Project not found");
    }
    let assignee: any = null;
    // validate assignee if present and not null
    if (
      typeof payload.assigneeId !== "undefined" &&
      payload.assigneeId !== null
    ) {
      const m = await prisma.teamMember.findUnique({
        where: { id: payload.assigneeId },
      });
      if (!m) throw new NotFoundException("Assignee not found");
      assignee = m;
    }

    // build clean data object with allowed fields only
    const data: any = {};
    if (typeof payload.title !== "undefined") data.title = payload.title;
    if (typeof payload.description !== "undefined")
      data.description = payload.description;
    if (typeof payload.projectId !== "undefined")
      data.projectId = payload.projectId;
    if (typeof payload.status !== "undefined") data.status = payload.status;
    if (typeof payload.priority !== "undefined")
      data.priority = payload.priority;
    if (typeof payload.assigneeId !== "undefined")
      data.assigneeId = payload.assigneeId;

    // keep date fields as strings to match Prisma schema
    if (typeof payload.startDate !== "undefined") {
      data.startDate =
        payload.startDate === null ? null : String(payload.startDate);
    }
    if (typeof payload.dueDate !== "undefined") {
      data.dueDate = payload.dueDate === null ? null : String(payload.dueDate);
    }

    data.updatedAt = new Date();

    const updated = await prisma.task.update({
      where: { id },
      data,
    });

    // include fresh comments in returned object (if needed)
    const withComments = await prisma.task.findUnique({
      where: { id: updated.id },
      include: {
        comments: {
          where: { isTrash: false },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    //send email to team members
    const teams = await prisma.teamMember.findMany({
      where: { workspaceId: project.workspaceId, isTrash: false },
      select: { email: true },
    });

    const projectName = project?.name ?? "No Project";

    const toEmails = teams.map((t) => t.email?.trim()).filter(Boolean);

    if (toEmails.length === 0) throw new Error("No recipient emails found");
    // Format tanggal
    const format = (d: any) =>
      d ? new Date(d).toLocaleDateString("en-US") : "—";

    const textMsg = `
    A new task has been created on CommitFlow

    Task Title:
    ${updated.title}

    Description:
    ${updated.description ?? "No description"}

    Status: ${updated.status}
    Assignee: ${assignee.name ?? "none"}
    Priority: ${updated.priority ?? "none"}
    Start Date: ${format(updated.startDate)}
    Due Date: ${format(updated.dueDate)}

    Project:
    ${projectName}

    Regards,
    CommitFlow Team
    `;

    const htmlMsg = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="margin-bottom: 8px;">📝 New Task Created</h2>
      <p>A new task has been created on <strong>CommitFlow</strong>.</p>

      <div style="padding: 14px 18px; background: #f8f9fa; border-radius: 10px; margin: 20px 0;">
        <p style="margin: 0; font-size: 15px;">
          <strong>Task Title:</strong><br>
          ${updated.title}
        </p>

        <p style="margin-top: 12px; font-size: 15px;">
          <strong>Description:</strong><br>
          ${updated.description ?? "No description"}
        </p>

        <p style="margin-top: 12px; font-size: 15px;">
          <strong>Status:</strong> ${updated.status}<br>
          <strong>Assignee:</strong> ${assignee.name ?? "none"}<br>
          <strong>Priority:</strong> ${updated.priority ?? "none"}
        </p>

        <p style="margin-top: 12px; font-size: 15px;">
          <strong>Start Date:</strong> ${format(updated.startDate)}<br>
          <strong>Due Date:</strong> ${format(updated.dueDate)}
        </p>

        <p style="margin-top: 12px; font-size: 15px;">
          <strong>Project:</strong><br>
          ${projectName}
        </p>
      </div>

      <p>You received this because you are a member of the workspace team.</p>

      <p style="margin-top: 24px; font-size: 14px; color: #666;">
        — CommitFlow Team
      </p>
    </div>
    `;

    // KIRIM EMAIL
    for (const recipient of toEmails) {
      await this.email.sendMail({
        to: recipient ?? "getechindonesia@gmail.com",
        subject: "New Task Created | CommitFlow",
        text: textMsg,
        html: htmlMsg,
      });

      await new Promise((r) => setTimeout(r, 200));
    }

    // serialize timestamps
    return {
      ...withComments,
      createdAt: withComments?.createdAt?.toISOString(),
      updatedAt: withComments?.updatedAt?.toISOString(),
      comments: (withComments?.comments || []).map((c) => ({
        ...c,
        createdAt: c.createdAt?.toISOString(),
        updatedAt: c.updatedAt?.toISOString(),
      })),
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
      assigneeId?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
    }>,
    userId: string
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
    payload: { author: string; body: string; attachments?: any[] }
  ) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException("Task not found");

    const c = await prisma.comment.create({
      data: {
        taskId,
        author: payload.author,
        body: payload.body,
        attachments: payload.attachments ?? undefined,
      },
    });
    return {
      ...c,
      createdAt: c.createdAt?.toISOString(),
      updatedAt: c.updatedAt?.toISOString(),
    };
  }

  async updateComment(
    taskId: string,
    commentId: string,
    patch: Partial<{ body?: string; attachments?: any[] }>
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
    }>
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
        console.log(user);
        // create team member
        const tm = await tx.teamMember.create({
          data: {
            name: user.name ?? "Unnamed",
            role: role ?? null,
            email: user.email ?? null,
            photo: user.photo ? user.photo : photo ?? null,
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

      return { teamMember: result.tm, user: result.user };
    } catch (err: any) {
      // Prisma unique constraint code P2002 — surface a friendly error
      if (err?.code === "P2002") {
        // you may inspect err.meta.target to know which field caused conflict
        throw new ConflictException(
          "Unique constraint failed (email or clientId)"
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
    }>
  ) {
    console.log(payload);
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
        console.log(user);
        return { teamMember: updatedTeam, user };
      });

      return result;
    } catch (err: any) {
      // Prisma unique constraint
      if (err?.code === "P2002") {
        // err.meta?.target may indicate which column (e.g. ['email'])
        throw new ConflictException(
          "Unique constraint failed (email or other field)"
        );
      }
      console.error("updateTeamMember error", err);
      throw new InternalServerErrorException("Failed to update team member");
    }
  }

  async deleteTeamMember(id: string) {
    const exists = await prisma.teamMember.findUnique({ where: { id } });
    if (!exists) return { success: false, deleted: false };

    // remove assignee relation on tasks if any
    await prisma.$transaction([
      prisma.task.updateMany({
        where: { assigneeId: id },
        data: { assigneeId: null },
      }),
      prisma.teamMember.update({
        where: { id },
        data: { isTrash: true },
      }),
    ]);
    return { success: true, deleted: true };
  }

  // Export XLSX
  async exportXlsx(): Promise<Buffer> {
    // fetch data
    const projects = await prisma.project.findMany({
      where: { isTrash: false },
    });

    // include assignee relation to get name easily
    const tasks = await prisma.task.findMany({
      where: { isTrash: false },
      include: { assignee: true },
      orderBy: { createdAt: "desc" },
    });
    console.log(tasks);
    const team = await prisma.teamMember.findMany({
      where: { isTrash: false },
      orderBy: { name: "asc" },
    });
    console.log(team);

    // debug logs to help diagnose empty-sheet issues
    console.log("[exportXlsx] projects:", projects.length);
    console.log("[exportXlsx] tasks:", tasks.length);
    console.log("[exportXlsx] team:", team.length);

    const wb = new ExcelJS.Workbook();

    // Projects sheet
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
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt?.toISOString(),
        updatedAt: p.updatedAt?.toISOString(),
      })
    );

    // Tasks sheet (include assigneeName column)
    const tSheet = wb.addWorksheet("Tasks");
    tSheet.columns = [
      { header: "id", key: "id" },
      { header: "title", key: "title" },
      { header: "description", key: "description" },
      { header: "projectId", key: "projectId" },
      { header: "status", key: "status" },
      { header: "assigneeId", key: "assigneeId" },
      { header: "assigneeName", key: "assigneeName" },
      { header: "priority", key: "priority" },
      { header: "startDate", key: "startDate" },
      { header: "dueDate", key: "dueDate" },
      { header: "createdAt", key: "createdAt" },
      { header: "updatedAt", key: "updatedAt" },
    ];

    // prepare quick lookup map for team by id (fallback)
    const teamById = new Map<string, any>();
    for (const m of team) teamById.set(m.id, m);

    tasks.forEach((t) => {
      const assigneeName =
        t.assignee?.name ??
        (t.assigneeId ? teamById.get(t.assigneeId)?.name : null) ??
        null;

      tSheet.addRow({
        id: t.id,
        title: t.title,
        description: t.description,
        projectId: t.projectId,
        status: t.status,
        assigneeId: t.assigneeId ?? null,
        assigneeName,
        priority: t.priority ?? null,
        startDate: t.startDate ?? null,
        dueDate: t.dueDate ?? null,
        createdAt: t.createdAt?.toISOString(),
        updatedAt: t.updatedAt?.toISOString(),
      });
    });

    // Team sheet
    const teamSheet = wb.addWorksheet("Team");
    teamSheet.columns = [
      { header: "id", key: "id" },
      { header: "name", key: "name" },
      { header: "role", key: "role" },
      { header: "email", key: "email" },
      { header: "photo", key: "photo" },
    ];
    team.forEach((m) =>
      teamSheet.addRow({
        id: m.id,
        name: m.name,
        role: m.role,
        email: m.email,
        photo: m.photo,
      })
    );

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

    // Projects
    const projectsSheet = workbook.getWorksheet("Projects");
    if (projectsSheet) {
      const rows = projectsSheet.getRows(2, projectsSheet.rowCount - 1) ?? [];
      for (const row of rows) {
        const id = row.getCell(1).value?.toString();
        const name = row.getCell(2).value?.toString() ?? "Untitled";
        const description = row.getCell(3).value?.toString() ?? null;
        const createdAtRaw = row.getCell(4).value;
        const createdAt = createdAtRaw
          ? new Date(createdAtRaw.toString())
          : new Date();

        if (id) {
          await prisma.project.upsert({
            where: { id },
            create: { id, name, description, createdAt },
            update: { name, description, updatedAt: new Date() },
          });
        } else {
          await prisma.project.create({
            data: { name, description, createdAt },
          });
        }
        created.projects++;
      }
    }

    // Team
    const teamSheet = workbook.getWorksheet("Team");
    if (teamSheet) {
      const rows = teamSheet.getRows(2, teamSheet.rowCount - 1) ?? [];
      for (const row of rows) {
        const id = row.getCell(1).value?.toString();
        const name = row.getCell(2).value?.toString() ?? "Unnamed";
        const role = row.getCell(3).value?.toString() ?? null;
        const email = row.getCell(4).value?.toString() ?? null;
        const photo = row.getCell(5).value?.toString() ?? null;

        if (id) {
          await prisma.teamMember.upsert({
            where: { id },
            create: { id, name, role, email, photo },
            update: { name, role, email, photo },
          });
        } else {
          await prisma.teamMember.create({
            data: { name, role, email, photo },
          });
        }
        created.team++;
      }
    }

    // Tasks
    const tasksSheet = workbook.getWorksheet("Tasks");
    if (tasksSheet) {
      const rows = tasksSheet.getRows(2, tasksSheet.rowCount - 1) ?? [];

      // preload team map to resolve names quickly
      const allTeam = await prisma.teamMember.findMany({
        where: { isTrash: false },
      });
      const teamMap = new Map<string, any>();
      for (const m of allTeam) teamMap.set(m.id, m);

      for (const row of rows) {
        const id = row.getCell(1).value?.toString();
        const title = row.getCell(2).value?.toString() ?? "Untitled";
        const description = row.getCell(3).value?.toString() ?? null;
        const projectId = row.getCell(4).value?.toString() ?? null;
        const status = row.getCell(5).value?.toString() ?? "todo";
        const assigneeIdCell = row.getCell(6).value?.toString() ?? null;
        const assigneeNameCell = row.getCell(7).value?.toString() ?? null;
        const priority = row.getCell(8).value?.toString() ?? null;
        const startDate = row.getCell(9).value?.toString() ?? null;
        const dueDate = row.getCell(10).value?.toString() ?? null;
        const createdAtRaw = row.getCell(11).value;
        const createdAt = createdAtRaw
          ? new Date(createdAtRaw.toString())
          : new Date();

        // resolve assigneeId preferring explicit id, fallback to name lookup
        let assigneeId = assigneeIdCell ?? null;
        if ((!assigneeId || assigneeId === "") && assigneeNameCell) {
          const found = allTeam.find((m) => m.name === assigneeNameCell);
          if (found) assigneeId = found.id;
        }

        if (id) {
          await prisma.task.upsert({
            where: { id },
            create: {
              id,
              title,
              description,
              projectId,
              status,
              assigneeId,
              priority,
              startDate,
              dueDate,
              createdAt,
            },
            update: {
              title,
              description,
              projectId,
              status,
              assigneeId,
              priority,
              startDate,
              dueDate,
              updatedAt: new Date(),
            },
          });
        } else {
          await prisma.task.create({
            data: {
              title,
              description,
              projectId,
              status,
              assigneeId,
              priority,
              startDate,
              dueDate,
              createdAt,
            },
          });
        }
        created.tasks++;
      }
    }

    // cleanup
    try {
      fs.unlinkSync(filePath);
    } catch {
      console.log("unlinksync failed");
    }

    return { success: true, ...created };
  }
}
