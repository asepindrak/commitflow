import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ActivityLogService } from "./activity-log.service";
import { JwtGuard } from "src/common/guards/jwt.guard";

@Controller("api/activity-log")
@UseGuards(JwtGuard)
export class ActivityLogController {
  constructor(private readonly svc: ActivityLogService) {}

  @Get()
  async list(
    @Query("workspaceId") workspaceId: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    if (!workspaceId) return [];
    return this.svc.getByWorkspace(
      workspaceId,
      limit ? parseInt(limit, 10) : 100,
      cursor || undefined,
    );
  }
}
