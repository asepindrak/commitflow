import { Body, Controller, Post, Req, Res, UseGuards } from "@nestjs/common";
import { AskService } from "./ask.service";
import { AskGateway } from "./ask.gateway";
import { JwtGuard } from "src/common/guards/jwt.guard";

@Controller("ask")
@UseGuards(JwtGuard)
export class AskController {
  constructor(
    private readonly askService: AskService,
    private readonly askGateway: AskGateway
  ) {}

  @Post()
  chat(@Body() data: any, @Res() res: Response, @Req() req: any) {
    const userId = req.user.userId; // <-- ambil userId dari JWT
    return this.askService.chat(data, res, this.askGateway?.server, userId);
  }
}
