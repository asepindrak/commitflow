import { Module } from "@nestjs/common";
import { DirectMessageController } from "./direct-message.controller";
import { DirectMessageService } from "./direct-message.service";
import { DirectMessageGateway } from "./direct-message.gateway";
import { PrismaClient } from "@prisma/client";

@Module({
  controllers: [DirectMessageController],
  providers: [
    DirectMessageService,
    DirectMessageGateway,
    { provide: PrismaClient, useValue: new PrismaClient() },
  ],
})
export class DirectMessageModule {}
