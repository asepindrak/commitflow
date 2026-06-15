import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { ActivityLogService } from "src/activity-log/activity-log.service";

@Injectable()
export class SprintService {
  constructor(
    private prisma: PrismaClient,
    private activityLog: ActivityLogService,
  ) {}

  async create(data: {
    workspaceId: string;
    name: string;
    description?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const sprint = await this.prisma.sprint.create({ data });
    this.activityLog
      .log({
        workspaceId: data.workspaceId,
        action: "sprint.changed",
        entity: "sprint",
        entityId: sprint.id,
        entityName: `Sprint "${sprint.name}" created`,
      })
      .catch(() => {});
    return sprint;
  }

  async findAll(workspaceId: string) {
    return this.prisma.sprint.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const sprint = await this.prisma.sprint.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
    this.activityLog
      .log({
        workspaceId: sprint.workspaceId,
        action: "sprint.changed",
        entity: "sprint",
        entityId: sprint.id,
        entityName: `Sprint "${sprint.name}" updated`,
      })
      .catch(() => {});
    return sprint;
  }

  async remove(id: string) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id } });
    if (sprint) {
      await this.prisma.task.updateMany({
        where: { sprintId: id },
        data: { sprintId: null },
      });
      const res = await this.prisma.sprint.delete({ where: { id } });
      this.activityLog
        .log({
          workspaceId: sprint.workspaceId,
          action: "sprint.changed",
          entity: "sprint",
          entityId: id,
          entityName: `Sprint "${sprint.name}" deleted`,
        })
        .catch(() => {});
      return res;
    }
    return null;
  }

  async getSprintTasks(sprintId: string) {
    return this.prisma.task.findMany({
      where: { sprintId, isTrash: false },
      include: { taskAssignees: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async assignTask(taskId: string, sprintId: string | null) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { sprintId },
    });

    if (task && task.project && task.project.workspaceId) {
      let sprintName = "Backlog";
      if (sprintId) {
        const s = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
        if (s) sprintName = s.name;
      }
      this.activityLog
        .log({
          workspaceId: task.project.workspaceId,
          action: "sprint.changed",
          entity: "sprint",
          entityId: sprintId ?? "backlog",
          entityName: `Task "${task.title}" assigned to Sprint "${sprintName}"`,
        })
        .catch(() => {});
    }
    return updated;
  }
}
