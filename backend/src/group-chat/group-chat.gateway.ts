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

interface PresenceInfo {
  memberId: string;
  memberName: string;
  workspaceId: string;
}

@WebSocketGateway({ cors: { origin: "*" } })
export class GroupChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GroupChatGateway.name);

  /** socket.id → presence info */
  private socketPresence = new Map<string, PresenceInfo>();

  /** memberId → last seen ISO string (set on disconnect) */
  private lastSeenMap = new Map<string, string>();

  constructor(private readonly chatService: GroupChatService) {}

  afterInit() {
    this.logger.log("GroupChatGateway initialised");
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
    const info = this.socketPresence.get(client.id);
    if (info) {
      this.socketPresence.delete(client.id);
      const stillOnline = this.isMemberOnline(info.memberId);
      if (!stillOnline) {
        const lastSeen = new Date().toISOString();
        this.lastSeenMap.set(info.memberId, lastSeen);
        this.server.to(`ws:${info.workspaceId}`).emit("presence:update", {
          memberId: info.memberId,
          status: "offline",
          lastSeen,
        });
      }
    }
  }

  /** Check if a member has any active socket */
  private isMemberOnline(memberId: string): boolean {
    for (const [, info] of this.socketPresence) {
      if (info.memberId === memberId) return true;
    }
    return false;
  }

  /** Get online member IDs for a workspace */
  private getOnlineMembers(workspaceId: string): string[] {
    const ids = new Set<string>();
    for (const [, info] of this.socketPresence) {
      if (info.workspaceId === workspaceId) ids.add(info.memberId);
    }
    return Array.from(ids);
  }

  /** Client joins a workspace room */
  @SubscribeMessage("group-chat:join")
  handleJoin(
    @MessageBody()
    data: { workspaceId: string; memberId?: string; memberName?: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.workspaceId) return;
    client.join(`ws:${data.workspaceId}`);
    this.logger.debug(`${client.id} joined room ws:${data.workspaceId}`);

    // Track presence if memberId provided
    if (data.memberId) {
      const wasOnline = this.isMemberOnline(data.memberId);
      this.socketPresence.set(client.id, {
        memberId: data.memberId,
        memberName: data.memberName ?? "",
        workspaceId: data.workspaceId,
      });

      // Broadcast online status if this is a new online member
      if (!wasOnline) {
        this.server.to(`ws:${data.workspaceId}`).emit("presence:update", {
          memberId: data.memberId,
          status: "online",
        });
      }

      // Send current presence list to the joining client
      const onlineIds = this.getOnlineMembers(data.workspaceId);
      const lastSeenEntries: Record<string, string> = {};
      for (const [mid, ts] of this.lastSeenMap) {
        if (!onlineIds.includes(mid)) lastSeenEntries[mid] = ts;
      }
      client.emit("presence:list", {
        online: onlineIds,
        lastSeen: lastSeenEntries,
      });
    }
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

  /** Client deletes their own message */
  @SubscribeMessage("group-chat:delete")
  async handleDelete(
    @MessageBody()
    data: {
      workspaceId: string;
      messageId: string;
      memberId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.workspaceId || !data?.messageId || !data?.memberId) return;

    const deleted = await this.chatService.deleteMessage(
      data.messageId,
      data.memberId,
    );
    if (!deleted) return; // not found or not owner

    this.server
      .to(`ws:${data.workspaceId}`)
      .emit("group-chat:deleted", { messageId: data.messageId });
  }

  /** Client pins/unpins a message */
  @SubscribeMessage("group-chat:pin")
  async handlePin(
    @MessageBody()
    data: {
      workspaceId: string;
      messageId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.workspaceId || !data?.messageId) return;

    const updated = await this.chatService.togglePin(data.messageId);
    if (!updated) return;

    this.server.to(`ws:${data.workspaceId}`).emit("group-chat:pinned", {
      messageId: data.messageId,
      isPinned: updated.isPinned,
    });
  }
}
