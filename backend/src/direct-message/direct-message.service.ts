import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class DirectMessageService {
  constructor(private readonly prisma: PrismaClient) {}

  async getConversation(
    workspaceId: string,
    memberA: string,
    memberB: string,
    limit = 60,
  ) {
    const rows = await this.prisma.directMessage.findMany({
      where: {
        workspaceId,
        OR: [
          { senderId: memberA, receiverId: memberB },
          { senderId: memberB, receiverId: memberA },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.reverse();
  }

  async saveMessage(data: {
    workspaceId: string;
    senderId: string;
    senderName: string;
    senderPhoto?: string | null;
    receiverId: string;
    content: string;
    attachments?: any;
  }) {
    return this.prisma.directMessage.create({ data });
  }

  async markRead(workspaceId: string, receiverId: string, senderId: string) {
    return this.prisma.directMessage.updateMany({
      where: {
        workspaceId,
        senderId,
        receiverId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  async getUnreadCounts(workspaceId: string, memberId: string) {
    const rows = await this.prisma.directMessage.groupBy({
      by: ["senderId"],
      where: {
        workspaceId,
        receiverId: memberId,
        isRead: false,
      },
      _count: { id: true },
    });
    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.senderId] = r._count.id;
    }
    return counts;
  }

  async deleteMessage(messageId: string, senderId: string) {
    const msg = await this.prisma.directMessage.findUnique({
      where: { id: messageId },
    });
    if (!msg || msg.senderId !== senderId) return null;
    await this.prisma.directMessage.delete({ where: { id: messageId } });
    return msg;
  }
}
