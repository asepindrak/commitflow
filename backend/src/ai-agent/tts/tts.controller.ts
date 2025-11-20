import { Body, Controller, Post, Res, UseGuards } from "@nestjs/common";
import { TtsService } from "./tts.service";
import type { Response } from "express";
import { JwtGuard } from "src/common/guards/jwt.guard";

@Controller("tts")
@UseGuards(JwtGuard)
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Post()
  tts(@Body() data: any, @Res() res: Response) {
    return this.ttsService.tts(data, res);
  }
}
