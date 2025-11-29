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
