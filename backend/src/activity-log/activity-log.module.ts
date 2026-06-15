import { Module } from "@nestjs/common";
import { ActivityLogController } from "./activity-log.controller";
import { ActivityLogService } from "./activity-log.service";

import { IntegrationsModule } from "src/integrations/integrations.module";

@Module({
  imports: [IntegrationsModule],
  controllers: [ActivityLogController],
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
