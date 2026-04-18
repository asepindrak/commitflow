// src/app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AskModule } from "./ai-agent/ask.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UsersModule } from "./users/users.module";
import { AskController } from "./ai-agent/ask.controller";
import { AskService } from "./ai-agent/ask.service";
import { AskGateway } from "./ai-agent/ask.gateway";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { AuthModule } from "./auth/auth.module";
import { JwtGuard } from "./common/guards/jwt.guard";
import { SharedModule } from "./common/shared.module";
import { UploadModule } from "./upload/upload.module";
import { ProjectManagementModule } from "./project-management/project-management.module";
import { EmailModule } from "./email/email.module";
import { GroupChatModule } from "./group-chat/group-chat.module";
import { ActivityLogModule } from "./activity-log/activity-log.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { SprintModule } from "./sprint/sprint.module";
import { DirectMessageModule } from "./direct-message/direct-message.module";
import { APP_GUARD } from "@nestjs/core";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "public"),
      serveRoot: "/",
    }),
    AuthModule,
    UsersModule,
    AskModule,
    SharedModule,
    UploadModule,
    ProjectManagementModule,
    EmailModule,
    GroupChatModule,
    ActivityLogModule,
    DashboardModule,
    SprintModule,
    DirectMessageModule,
  ],
  controllers: [AppController, AskController],
  providers: [
    AppService,
    AskService,
    AskGateway,
    // Register JwtGuard as a global guard via APP_GUARD so Reflector and DI work properly
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
  ],
})
export class AppModule {}
