import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { GroupChatService } from "./group-chat.service";

@WebSocketGateway({ cors: { origin: "*" } })
export class GroupChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GroupChatGateway.name);

  constructor(private readonly chatService: GroupChatService) {}

  afterInit() {
    this.logger.log("GroupChatGateway initialised");
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /** Client joins a workspace room */
  @SubscribeMessage("group-chat:join")
  handleJoin(
    @MessageBody() data: { workspaceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.workspaceId) return;
    client.join(`ws:${data.workspaceId}`);
    this.logger.debug(`${client.id} joined room ws:${data.workspaceId}`);
  }

  /** Client leaves a workspace room */
  @SubscribeMessage("group-chat:leave")
  handleLeave(
    @MessageBody() data: { workspaceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.workspaceId) return;
    client.leave(`ws:${data.workspaceId}`);
  }

  /** Client sends a message (content and/or attachments) */
  @SubscribeMessage("group-chat:send")
  async handleSend(
    @MessageBody()
    data: {
      workspaceId: string;
      memberId: string;
      memberName: string;
      memberPhoto?: string;
      content: string;
      attachments?: Array<{
        url: string;
        name: string;
        type: string;
        size: number;
      }>;
      replyTo?: {
        id: string;
        memberName: string;
        content: string;
        attachments?: Array<{
          url: string;
          name: string;
          type: string;
          size: number;
        }> | null;
      };
    },
    @ConnectedSocket() client: Socket,
  ) {
    const hasContent = data?.content?.trim();
    const hasAttachments =
      Array.isArray(data?.attachments) && data.attachments.length > 0;
    if (!data?.workspaceId || (!hasContent && !hasAttachments)) return;

    const saved = await this.chatService.saveMessage({
      workspaceId: data.workspaceId,
      memberId: data.memberId,
      memberName: data.memberName,
      memberPhoto: data.memberPhoto ?? null,
      content: data.content?.trim() ?? "",
      attachments: hasAttachments ? data.attachments : undefined,
      replyTo: data.replyTo ?? undefined,
    });

    // broadcast to everyone in the room (including sender)
    this.server.to(`ws:${data.workspaceId}`).emit("group-chat:message", saved);
  }
}
