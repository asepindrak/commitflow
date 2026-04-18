import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { JwtGuard } from "src/common/guards/jwt.guard";

@Controller("api/dashboard")
@UseGuards(JwtGuard)
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get()
  async stats(@Query("workspaceId") workspaceId: string) {
    if (!workspaceId) return {};
    return this.svc.getStats(workspaceId);
  }
}
