import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

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
  async log(dto: LogActivityDto) {
    return prisma.activityLog.create({
      data: {
        workspaceId: dto.workspaceId,
        memberId: dto.memberId ?? null,
        memberName: dto.memberName ?? null,
        action: dto.action,
        entity: dto.entity ?? null,
        entityId: dto.entityId ?? null,
        entityName: dto.entityName ?? null,
        meta: dto.meta ?? undefined,
      },
    });
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
