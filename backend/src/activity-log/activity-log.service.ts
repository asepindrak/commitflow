import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { IntegrationsService } from "src/integrations/integrations.service";

const prisma = new PrismaClient();

export interface LogActivityDto {
  workspaceId: string;
  memberId?: string;
  memberName?: string;
  action: string;
  entity?: string;
  entityId?: string;
  entityName?: string;
  meta?: Record<string, any>;
}

@Injectable()
export class ActivityLogService {
  constructor(private readonly integrations: IntegrationsService) {}

  async log(dto: LogActivityDto) {
    let resolvedMemberName = dto.memberName;

    if (!resolvedMemberName && dto.memberId) {
      try {
        const member = await prisma.teamMember.findFirst({
          where: {
            workspaceId: dto.workspaceId,
            OR: [
              { id: dto.memberId },
              { userId: dto.memberId },
            ],
          },
        });
        if (member) {
          resolvedMemberName = member.name;
        }
      } catch (err) {
        console.error("Error resolving member name in ActivityLogService", err);
      }
    }

    const createdLog = await prisma.activityLog.create({
      data: {
        workspaceId: dto.workspaceId,
        memberId: dto.memberId ?? null,
        memberName: resolvedMemberName ?? null,
        action: dto.action,
        entity: dto.entity ?? null,
        entityId: dto.entityId ?? null,
        entityName: dto.entityName ?? null,
        meta: dto.meta ?? undefined,
      },
    });

    // Dispatch integrations notifications in background
    this.integrations
      .triggerNotifications(
        dto.workspaceId,
        dto.action,
        dto.entity ?? null,
        dto.entityId ?? null,
        dto.entityName ?? null,
        resolvedMemberName ?? null,
        dto.meta ?? null,
      )
      .catch((err) => {
        console.error("Error triggering notifications inside ActivityLogService", err);
      });

    return createdLog;
  }

  async getByWorkspace(workspaceId: string, limit = 100, cursor?: string) {
    const where: any = { workspaceId };

    const items = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    return items.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
    }));
  }
}
