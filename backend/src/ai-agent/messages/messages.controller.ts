import { Controller, Delete, Get, Param, Req, UseGuards } from "@nestjs/common";
import { JwtGuard } from "src/common/guards/jwt.guard";
import { MessagesService } from "./messages.service";

@Controller("messages")
@UseGuards(JwtGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  findAll(@Req() req: any) {
    const userId = req.user.userId; // <-- ambil userId dari JWT
    return this.messagesService.findAll(userId);
  }

  @Delete("/all")
  deleteAll(@Req() req: any) {
    console.log("delete all message");
    const userId = req.user.userId; // <-- ambil userId dari JWT
    return this.messagesService.deleteAll(userId);
  }

  @Delete(":id")
  delete(@Req() req: any, @Param("id") id: string) {
    const userId = req.user.userId; // <-- ambil userId dari JWT
    return this.messagesService.delete(userId, id);
  }
}
