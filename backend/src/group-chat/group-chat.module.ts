import { Module } from "@nestjs/common";
import { GroupChatController } from "./group-chat.controller";
import { GroupChatService } from "./group-chat.service";
import { GroupChatGateway } from "./group-chat.gateway";
import { PrismaClient } from "@prisma/client";

@Module({
  controllers: [GroupChatController],
  providers: [
    GroupChatService,
    GroupChatGateway,
    {
      provide: PrismaClient,
      useValue: new PrismaClient(),
    },
  ],
})
export class GroupChatModule {}
