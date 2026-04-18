import {
  Controller,
  Get,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  Put,
} from "@nestjs/common";
import { DirectMessageService } from "./direct-message.service";

@Controller("api/dm")
export class DirectMessageController {
  constructor(private readonly svc: DirectMessageService) {}

  @Get("conversation")
  getConversation(
    @Query("workspaceId") workspaceId: string,
    @Query("memberA") memberA: string,
    @Query("memberB") memberB: string,
    @Query("limit", new DefaultValuePipe(60), ParseIntPipe) limit: number,
  ) {
    return this.svc.getConversation(
      workspaceId,
      memberA,
      memberB,
      Math.min(limit, 200),
    );
  }

  @Get("unread")
  getUnread(
    @Query("workspaceId") workspaceId: string,
    @Query("memberId") memberId: string,
  ) {
    return this.svc.getUnreadCounts(workspaceId, memberId);
  }

  @Put("read")
  markRead(
    @Query("workspaceId") workspaceId: string,
    @Query("receiverId") receiverId: string,
    @Query("senderId") senderId: string,
  ) {
    return this.svc.markRead(workspaceId, receiverId, senderId);
  }
}
