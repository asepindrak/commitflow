import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { DirectMessageService } from "./direct-message.service";

@WebSocketGateway({ cors: { origin: "*" } })
export class DirectMessageGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DirectMessageGateway.name);

  constructor(private readonly dmService: DirectMessageService) {}

  @SubscribeMessage("dm:send")
  async handleSend(
    @MessageBody()
    data: {
      workspaceId: string;
      senderId: string;
      senderName: string;
      senderPhoto?: string;
      receiverId: string;
      content: string;
      attachments?: Array<{
        url: string;
        name: string;
        type: string;
        size: number;
      }>;
    },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.workspaceId || !data?.content?.trim()) return;

    const saved = await this.dmService.saveMessage({
      workspaceId: data.workspaceId,
      senderId: data.senderId,
      senderName: data.senderName,
      senderPhoto: data.senderPhoto ?? null,
      receiverId: data.receiverId,
      content: data.content.trim(),
      attachments: data.attachments ?? undefined,
    });

    // Emit to workspace room so both parties get it
    this.server.to(`ws:${data.workspaceId}`).emit("dm:message", saved);
  }

  @SubscribeMessage("dm:delete")
  async handleDelete(
    @MessageBody()
    data: {
      workspaceId: string;
      messageId: string;
      senderId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.workspaceId || !data?.messageId || !data?.senderId) return;
    const deleted = await this.dmService.deleteMessage(
      data.messageId,
      data.senderId,
    );
    if (!deleted) return;
    this.server
      .to(`ws:${data.workspaceId}`)
      .emit("dm:deleted", { messageId: data.messageId });
  }

  @SubscribeMessage("dm:read")
  async handleRead(
    @MessageBody()
    data: { workspaceId: string; receiverId: string; senderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.workspaceId) return;
    await this.dmService.markRead(
      data.workspaceId,
      data.receiverId,
      data.senderId,
    );
    this.server
      .to(`ws:${data.workspaceId}`)
      .emit("dm:read", {
        receiverId: data.receiverId,
        senderId: data.senderId,
      });
  }
}
