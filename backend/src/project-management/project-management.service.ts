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

const FE_URL = process.env?.FE_URL ?? "";

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

    let assigneeId: string | null = null;

    if (typeof payload.assigneeId !== "undefined") {
      // client provided something (could be null)
      if (payload.assigneeId === null) {
        assigneeId = null;
      } else {
        // validate it exists
        const member = await prisma.teamMember.findUnique({
          where: { id: payload.assigneeId },
        });
        if (!member) {
          throw new BadRequestException(
            `assigneeId ${payload.assigneeId} not found`
          );
        }
        assigneeId = member.id;
      }
    } else {
      // client did NOT provide assigneeId -> pick a sensible default (or null)
      const member = await prisma.teamMember.findFirst();
      assigneeId = member?.id ?? null;
    }

    // Defensive idempotency: if clientId provided and server already has it, return existing row
    if (payload.clientId) {
      const existing = await prisma.task.findFirst({
        where: { clientId: payload.clientId },
      });
      if (existing) {
        console.log("[createTask] idempotent hit, returning existing");
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
        // always pass either null or a valid id — never empty string
        assigneeId: assigneeId,
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
    const exists: any = await prisma.task.findUnique({ where: { id } });
    const data: any = exists;
    if (!exists) throw new NotFoundException("Task not found");
    const updatedAt = exists.updatedAt;
    const status = exists.status;
    const priority = exists.priority;
    const description = exists.description;
    const startDate = exists.description;
    const dueDate = exists.dueDate;
    const assigneeId = exists.assigneeId;

    let project: any = null;
    // validate projectId if present and not null (null means detach project)
    if (typeof exists.projectId !== "undefined" && exists.projectId !== null) {
      project = await prisma.project.findUnique({
        where: { id: exists.projectId },
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
      if (!m) throw new NotFoundException("Assignee not found (payload)");
      assignee = m;
    } else if (data.assigneeId !== "undefined" && data.assigneeId !== null) {
      const m = await prisma.teamMember.findUnique({
        where: { id: data.assigneeId },
      });
      if (!m) throw new NotFoundException("Assignee not found (data)");
      assignee = m;
    }

    // build clean data object with allowed fields only
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
      where: {
        workspaceId: project.workspaceId,
        isTrash: false,
        OR: [
          { isAdmin: true },
          { id: data.assigneeId ?? "" },
          { id: data.createdById ?? "" },
        ],
      },
      select: { email: true },
    });

    const projectName = project?.name ?? "No Project";

    const toEmails = Array.from(
      new Set(
        teams
          .map((t) => t.email?.trim().toLowerCase()) // normalisasi
          .filter(Boolean) // buang null/undefined/empty
      )
    );

    if (toEmails.length === 0) throw new Error("No recipient emails found");
    // Format tanggal
    const format = (d: any) =>
      d ? new Date(d).toLocaleDateString("en-US") : "—";

    let emailTitle = `➕ New Task Created`;
    let emailDescription = `➕ A new task has been created on <strong>${projectName}</strong>.`;
    if (updatedAt) {
      emailTitle = `📝 Task Updated`;
      emailDescription = `📝 A task has been updated on <strong>${projectName}</strong>.`;
    }

    if (status !== data.status) {
      emailTitle = `➡️ Task Moved To ${data.status}`;
      emailDescription = `➡️ A task has been moved to ${data.status} on <strong>${projectName}</strong>.`;
    }

    if (priority !== data.priority) {
      emailTitle = `⚡ Task Priority Changed To ${data.priority}`;
      emailDescription = `⚡ A task priority has been changed to ${data.priority} on <strong>${projectName}</strong>.`;
    }

    if (description !== data.description) {
      emailTitle = `📝 Task Description has Changed`;
      emailDescription = `📝 A task description has been changed on <strong>${projectName}</strong>.`;
    }

    if (startDate !== data.startDate) {
      emailTitle = `📅 Task Start date has Changed To ${data.startDate}`;
      emailDescription = `📅 A task Task Start date has been changed to ${data.startDate} on <strong>${projectName}</strong>.`;
    }

    if (dueDate !== data.dueDate) {
      emailTitle = `📅 Task Due date has Changed To ${data.dueDate}`;
      emailDescription = `📅 A task Due date has been changed to ${data.dueDate} on <strong>${projectName}</strong>.`;
    }

    if (assigneeId !== data.assigneeId) {
      emailTitle = `👤 Task Assignee has Changed to ${
        assignee?.name ?? "none"
      }`;
      emailDescription = `👤 A task Assignee has been changed to ${
        assignee?.name ?? "none"
      } on <strong>${projectName}</strong>.`;
    }

    const textMsg = `
    ${emailDescription}

    Task Title:
    ${updated.title}

    Description:
    ${updated.description ?? "No description"}

    Status: ${updated?.status}
    Assignee: ${assignee?.name ?? "none"}
    Priority: ${updated?.priority ?? "none"}
    Start Date: ${format(updated?.startDate)}
    Due Date: ${format(updated?.dueDate)}

    Project:
    ${projectName}

    Regards,
    CommitFlow Team
    `;

    const htmlMsg = `
      <div style="font-family: Arial, sans-serif; background:#f4f5f7; padding:24px;">
        <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:10px; padding:32px; box-shadow:0 4px 12px rgba(0,0,0,0.05);">

          <h2 style="color:#2d3748; margin:0 0 8px; font-size:22px;">
            ${emailTitle}
          </h2>

          <p style="color:#4a5568; margin:0 0 20px; font-size:15px;">
            ${emailDescription}
          </p>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:20px; margin-bottom:24px;">

            <p style="margin:0 0 14px; font-size:15px; color:#1a202c;">
              <strong style="color:#2b6cb0;">Task Title:</strong><br>
              ${updated.title}
            </p>

            <p style="margin:0 0 14px; font-size:15px;">
              <strong style="color:#2b6cb0;">Description:</strong><br>
              ${updated.description ?? "No description"}
            </p>

            <p style="margin:0 0 14px; font-size:15px;">
              <strong style="color:#2b6cb0;">Status:</strong> ${
                updated?.status
              }<br>
              <strong style="color:#2b6cb0;">Assignee:</strong> ${
                assignee?.name ?? "none"
              }<br>
              <strong style="color:#2b6cb0;">Priority:</strong> ${
                updated?.priority ?? "none"
              }
            </p>

            <p style="margin:0 0 14px; font-size:15px;">
              <strong style="color:#2b6cb0;">Start Date:</strong> ${format(
                updated?.startDate
              )}<br>
              <strong style="color:#2b6cb0;">Due Date:</strong> ${format(
                updated?.dueDate
              )}
            </p>

            <p style="margin:0; font-size:15px;">
              <strong style="color:#2b6cb0;">Project:</strong><br>
              ${projectName}
            </p>
          </div>

          <div style="text-align:center; margin-bottom:28px;">
            <a href="${FE_URL}"
              style="background:#2b6cb0; color:#fff; padding:12px 20px; border-radius:6px; text-decoration:none; font-size:14px; display:inline-block;">
              Open Task
            </a>
          </div>

          <p style="font-size:14px; color:#4a5568;">
            You received this because you are a member of the workspace team.
          </p>

          <p style="font-size:13px; color:#a0aec0; text-align:center; margin-top:22px;">
            — CommitFlow Team
          </p>

        </div>
      </div>
    `;

    // KIRIM EMAIL
    for (const recipient of toEmails) {
      await this.email.sendMail({
        to: recipient ?? "",
        subject: `${emailTitle} | CommitFlow`,
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

    //send email to team members
    const p = await prisma.project.findFirst({
      where: { id: task.projectId ?? "", isTrash: false },
    });

    if (!p) throw new NotFoundException("Project not found");

    //send email to team members
    const teams = await prisma.teamMember.findMany({
      where: {
        workspaceId: p.workspaceId ?? "",
        isTrash: false,
        OR: [
          { isAdmin: true },
          { id: task.assigneeId ?? "" },
          { id: task.createdById ?? "" },
        ],
      },
      select: { email: true },
    });

    // Extract + normalize + deduplicate emails
    const toEmails = Array.from(
      new Set(teams.map((t) => t.email?.trim().toLowerCase()).filter(Boolean))
    );

    if (toEmails.length === 0) throw new Error("No recipient emails found");

    const projectName = p.name;
    const taskName = task.title;
    const author = payload.author;
    const body = payload.body;

    const textMsg = `
      💬 New Comment!

      Project Name:
      ${projectName}

      Task Name:
      ${taskName}

      Author:
      ${author}

      Comment:
      ${body}

      You are receiving this notification because you are part of the workspace team.

      Regards,
      CommitFlow Team
    `;

    const htmlMsg = `
      <div style="font-family: Arial, sans-serif; background:#f4f5f7; padding:24px;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:10px; padding:28px; box-shadow:0 6px 20px rgba(13,38,59,0.06);">

          <!-- Header -->
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
            <!-- optional small logo area -->
            <div style="width:44px; height:44px; border-radius:8px; background:#eef2ff; display:flex; align-items:center; justify-content:center; font-size:20px;">
              💬
            </div>
            <div>
              <h2 style="color:#2d3748; font-size:18px; margin:0;">💬 New Comment!</h2>
              <p style="margin:4px 0 0; color:#4a5568; font-size:13px;">Ada komentar baru di task yang kamu ikuti.</p>
            </div>
          </div>

          <!-- Card -->
          <div style="background:#f8fafc; border:1px solid #e6eef9; border-radius:10px; padding:18px; margin:18px 0;">
            <p style="margin:0 0 10px; font-size:14px; color:#1a202c;">
              <strong style="color:#2b6cb0;">Project</strong><br>
              ${projectName ?? "—"}
            </p>

            <p style="margin:0 0 10px; font-size:14px; color:#1a202c;">
              <strong style="color:#2b6cb0;">Task</strong><br>
              ${taskName ?? "—"}
            </p>

            <p style="margin:0 0 10px; font-size:14px; color:#1a202c;">
              <strong style="color:#2b6cb0;">Author</strong><br>
              ${author ?? "Unknown"}
            </p>

            <div style="margin-top:6px; padding:12px; background:#ffffff; border-radius:8px; border:1px solid #edf2f7;">
              <p style="margin:0; font-size:14px; color:#2d3748; line-height:1.5; white-space:pre-wrap;">
                <strong style="display:block; color:#2b6cb0; margin-bottom:8px;">Comment</strong>
                ${
                  body && body.length > 100
                    ? body.slice(0, 300) + "…"
                    : body ?? "No comment content"
                }
              </p>
            </div>
          </div>

          <!-- CTA -->
          <div style="text-align:center; margin:18px 0;">
            <a href="${FE_URL}"
              style="display:inline-block; background:#2b6cb0; color:#fff; padding:12px 18px; border-radius:8px; text-decoration:none; font-size:14px;">
              Open Comment in CommitFlow
            </a>
          </div>

          <p style="font-size:13px; color:#4a5568; text-align:center; margin-top:8px;">
            You are receiving this because you are a member of this workspace.
          </p>

          <p style="font-size:13px; color:#a0aec0; text-align:center; margin-top:18px;">
            — CommitFlow Team
          </p>

        </div>
      </div>
    `;

    for (const recipient of toEmails) {
      try {
        await this.email.sendMail({
          to: recipient ?? "",
          subject: "💬 New Comment | CommitFlow",
          text: textMsg,
          html: htmlMsg,
        });
      } catch (error) {
        logger.error(error);
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

  async inviteTeamMember(
    payload: { email: string; workspaceId: string },
    userId: string
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

    const team = await prisma.teamMember.findMany({
      where: { isTrash: false },
      orderBy: { name: "asc" },
    });

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
