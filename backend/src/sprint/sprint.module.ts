import { Module } from "@nestjs/common";
import { SprintController } from "./sprint.controller";
import { SprintService } from "./sprint.service";

import { ActivityLogModule } from "src/activity-log/activity-log.module";

@Module({
  imports: [ActivityLogModule],
  controllers: [SprintController],
  providers: [SprintService],
  exports: [SprintService],
})
export class SprintModule {}
