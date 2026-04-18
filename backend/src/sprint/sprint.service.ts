import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class SprintService {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    workspaceId: string;
    name: string;
    description?: string;
    startDate?: string;
    endDate?: string;
  }) {
    return this.prisma.sprint.create({ data });
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
    return this.prisma.sprint.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async remove(id: string) {
    // Unlink tasks first
    await this.prisma.task.updateMany({
      where: { sprintId: id },
      data: { sprintId: null },
    });
    return this.prisma.sprint.delete({ where: { id } });
  }

  async getSprintTasks(sprintId: string) {
    return this.prisma.task.findMany({
      where: { sprintId, isTrash: false },
      include: { taskAssignees: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async assignTask(taskId: string, sprintId: string | null) {
    return this.prisma.task.update({
      where: { id: taskId },
      data: { sprintId },
    });
  }
}
