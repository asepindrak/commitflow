import {
  Controller,
  Get,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from "@nestjs/common";
import { GroupChatService } from "./group-chat.service";

@Controller("api/group-chat")
export class GroupChatController {
  constructor(private readonly chatService: GroupChatService) {}

  /** GET /api/group-chat/messages?workspaceId=xxx&limit=60 */
  @Get("messages")
  getMessages(
    @Query("workspaceId") workspaceId: string,
    @Query("limit", new DefaultValuePipe(60), ParseIntPipe) limit: number,
  ) {
    return this.chatService.getMessages(workspaceId, Math.min(limit, 200));
  }
}
