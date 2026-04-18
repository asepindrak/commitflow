import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class GroupChatService {
  constructor(private readonly prisma: PrismaClient) {}

  async getMessages(workspaceId: string, limit = 60) {
    const rows = await this.prisma.groupChatMessage.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    // return in chronological order for the client
    return rows.reverse();
  }

  async saveMessage(data: {
    workspaceId: string;
    memberId: string;
    memberName: string;
    memberPhoto?: string | null;
    content: string;
    attachments?: any;
    replyTo?: any;
  }) {
    return this.prisma.groupChatMessage.create({ data });
  }

  async deleteMessage(messageId: string, memberId: string) {
    const msg = await this.prisma.groupChatMessage.findUnique({
      where: { id: messageId },
    });
    if (!msg || msg.memberId !== memberId) return null;
    await this.prisma.groupChatMessage.delete({ where: { id: messageId } });
    return msg;
  }

  async togglePin(messageId: string) {
    const msg = await this.prisma.groupChatMessage.findUnique({
      where: { id: messageId },
    });
    if (!msg) return null;
    return this.prisma.groupChatMessage.update({
      where: { id: messageId },
      data: { isPinned: !msg.isPinned },
    });
  }

  async getPinnedMessages(workspaceId: string) {
    return this.prisma.groupChatMessage.findMany({
      where: { workspaceId, isPinned: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
