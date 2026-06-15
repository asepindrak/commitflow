import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { JwtGuard } from "src/common/guards/jwt.guard";
import { IntegrationsService } from "./integrations.service";

@Controller("api/integrations")
@UseGuards(JwtGuard)
export class IntegrationsController {
  constructor(private readonly svc: IntegrationsService) {}

  // --- Webhooks Endpoints ---
  @Get("webhooks/:workspaceId")
  getWebhooks(@Param("workspaceId") workspaceId: string) {
    return this.svc.getWebhooks(workspaceId);
  }

  @Post("webhooks")
  createWebhook(
    @Body() body: { workspaceId: string; url: string; events: string[] },
  ) {
    return this.svc.createWebhook(body.workspaceId, body.url, body.events);
  }

  @Put("webhooks/:id/toggle")
  toggleWebhook(@Param("id") id: string) {
    return this.svc.toggleWebhook(id);
  }

  @Delete("webhooks/:id")
  deleteWebhook(@Param("id") id: string) {
    return this.svc.deleteWebhook(id);
  }

  // --- Telegram Endpoints ---
  @Get("telegram/:workspaceId")
  getTelegramIntegrations(
    @Param("workspaceId") workspaceId: string,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.svc.getTelegramIntegrations(workspaceId, userId);
  }

  @Post("telegram")
  createTelegramIntegration(
    @Body()
    body: {
      workspaceId: string;
      botToken: string;
      telegramId: string;
      events: string[];
    },
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.svc.createTelegramIntegration(
      body.workspaceId,
      userId,
      body.botToken,
      body.telegramId,
      body.events,
    );
  }

  @Put("telegram/:id/toggle")
  toggleTelegramIntegration(@Param("id") id: string) {
    return this.svc.toggleTelegramIntegration(id);
  }

  @Delete("telegram/:id")
  deleteTelegramIntegration(@Param("id") id: string) {
    return this.svc.deleteTelegramIntegration(id);
  }
}
