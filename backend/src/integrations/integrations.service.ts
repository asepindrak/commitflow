import { Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { Telegraf } from "telegraf";

const prisma = new PrismaClient();

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  // Webhooks management
  async getWebhooks(workspaceId: string) {
    return prisma.webhook.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createWebhook(workspaceId: string, url: string, events: string[]) {
    return prisma.webhook.create({
      data: {
        workspaceId,
        url,
        events,
        active: true,
      },
    });
  }

  async toggleWebhook(id: string) {
    const existing = await prisma.webhook.findUnique({ where: { id } });
    if (!existing) throw new Error("Webhook not found");
    return prisma.webhook.update({
      where: { id },
      data: { active: !existing.active },
    });
  }

  async deleteWebhook(id: string) {
    return prisma.webhook.delete({ where: { id } });
  }

  // Telegram integrations management
  async getTelegramIntegrations(workspaceId: string, userId: string) {
    return prisma.telegramIntegration.findMany({
      where: { workspaceId, userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createTelegramIntegration(
    workspaceId: string,
    userId: string,
    botToken: string,
    telegramId: string,
    events: string[],
  ) {
    // Check if telegram integration already exists for this user in this workspace
    const existing = await prisma.telegramIntegration.findFirst({
      where: { workspaceId, userId, telegramId, botToken },
    });

    if (existing) {
      return prisma.telegramIntegration.update({
        where: { id: existing.id },
        data: { events, active: true },
      });
    }

    return prisma.telegramIntegration.create({
      data: {
        workspaceId,
        userId,
        botToken,
        telegramId,
        events,
        active: true,
      },
    });
  }

  async toggleTelegramIntegration(id: string) {
    const existing = await prisma.telegramIntegration.findUnique({ where: { id } });
    if (!existing) throw new Error("Telegram integration not found");
    return prisma.telegramIntegration.update({
      where: { id },
      data: { active: !existing.active },
    });
  }

  async deleteTelegramIntegration(id: string) {
    return prisma.telegramIntegration.delete({ where: { id } });
  }

  // Notification Dispatcher
  async triggerNotifications(
    workspaceId: string,
    action: string,
    entity: string | null,
    entityId: string | null,
    entityName: string | null,
    memberName: string | null,
    meta: any,
  ) {
    // Map database actions to frontend integration events
    let eventKey = action;
    if (action === "task.status_changed") {
      eventKey = "task.updated";
    } else if (action === "member.added") {
      eventKey = "member.joined";
    }

    // Fetch workspace name
    let workspaceName = "Workspace";
    try {
      const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
      if (ws) {
        workspaceName = ws.name;
      }
    } catch (err) {
      this.logger.error("Error fetching workspace name", err);
    }

    // 1. Dispatch to Webhooks
    try {
      const webhooks = await prisma.webhook.findMany({
        where: { workspaceId, active: true },
      });

      for (const wh of webhooks) {
        const whEvents = wh.events as string[];
        if (whEvents.includes(eventKey)) {
          // Send axios post request in background
          axios
            .post(wh.url, {
              event: eventKey,
              workspaceId,
              workspaceName,
              timestamp: new Date().toISOString(),
              data: {
                action,
                entity,
                entityId,
                entityName,
                memberName,
                meta,
              },
            })
            .then(() => {
              this.logger.log(`Webhook sent to ${wh.url} for event ${eventKey}`);
            })
            .catch((err) => {
              this.logger.error(`Failed to send webhook to ${wh.url}: ${err.message}`);
            });
        }
      }
    } catch (err) {
      this.logger.error("Error dispatching webhooks", err);
    }

    // 2. Dispatch to Telegram integrations
    try {
      const telegrams = await prisma.telegramIntegration.findMany({
        where: { workspaceId, active: true },
      });

      for (const tg of telegrams) {
        const tgEvents = tg.events as string[];
        if (tgEvents.includes(eventKey)) {
          // Format message
          const text = this.formatTelegramMessage(
            workspaceName,
            eventKey,
            action,
            entityName,
            memberName,
            meta,
          );

          // Use telegraf to send message in background
          const bot = new Telegraf(tg.botToken);
          bot.telegram
            .sendMessage(tg.telegramId, text, { parse_mode: "HTML" })
            .then(() => {
              this.logger.log(`Telegram notification sent via bot to ${tg.telegramId}`);
            })
            .catch((err) => {
              this.logger.error(`Failed to send Telegram notification to ${tg.telegramId}: ${err.message}`);
            });
        }
      }
    } catch (err) {
      this.logger.error("Error dispatching Telegram notifications", err);
    }
  }

  private formatTelegramMessage(
    workspaceName: string,
    eventKey: string,
    action: string,
    entityName: string | null,
    memberName: string | null,
    meta: any,
  ): string {
    const actor = memberName || "Someone";
    let title = "";
    let details = "";

    switch (eventKey) {
      case "task.created":
        title = "🚀 <b>New Task Created</b>";
        details = `<b>Task:</b> ${entityName || "Unnamed Task"}`;
        break;
      case "task.updated":
        if (action === "task.status_changed") {
          title = "🔄 <b>Task Status Changed</b>";
          const fromStatus = meta?.from || "unknown";
          const toStatus = meta?.to || "unknown";
          details = `<b>Task:</b> ${entityName || "Unnamed Task"}\n<b>Status:</b> <code>${fromStatus}</code> ➡️ <code>${toStatus}</code>`;
        } else {
          title = "✏️ <b>Task Updated</b>";
          details = `<b>Task:</b> ${entityName || "Unnamed Task"}`;
        }
        break;
      case "task.deleted":
        title = "🗑️ <b>Task Deleted</b>";
        details = `<b>Task:</b> ${entityName || "Unnamed Task"}`;
        break;
      case "comment.added":
        title = "💬 <b>New Comment Added</b>";
        const commentBody = meta?.body || "";
        const truncatedBody = commentBody.length > 150 ? commentBody.slice(0, 150) + "..." : commentBody;
        details = `<b>Task:</b> ${entityName || "Unnamed Task"}\n<b>Comment:</b> <i>"${truncatedBody}"</i>`;
        break;
      case "sprint.changed":
        title = "🏃 <b>Sprint Changed</b>";
        details = `<b>Sprint:</b> ${entityName || "Sprint Event"}`;
        break;
      case "member.joined":
        title = "👋 <b>New Member Joined</b>";
        details = `<b>Member:</b> ${entityName || "New Member"}`;
        break;
      default:
        title = `📢 <b>Event: ${eventKey}</b>`;
        details = `<b>Target:</b> ${entityName || "None"}`;
    }

    return `${title}\n\n<b>Workspace:</b> ${workspaceName}\n${details}\n<b>By:</b> ${actor}`;
  }
}
