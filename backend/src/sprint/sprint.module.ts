import { Module } from "@nestjs/common";
import { SprintController } from "./sprint.controller";
import { SprintService } from "./sprint.service";

@Module({
  controllers: [SprintController],
  providers: [SprintService],
  exports: [SprintService],
})
export class SprintModule {}
