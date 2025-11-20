// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AskModule } from './ai-agent/ask.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AskController } from "./ai-agent/ask.controller";
import { AskService } from "./ai-agent/ask.service";
import { AskGateway } from "./ai-agent/ask.gateway";
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthModule } from "./auth/auth.module";
import { JwtGuard } from "./common/guards/jwt.guard";
import { SharedModule } from "./common/shared.module";
import { UploadModule } from './upload/upload.module';
import { ProjectManagementModule } from './project-management/project-management.module';

@Module({
  imports: [
    // config global (baca .env)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Serve folder public sebagai static files
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
    }),

    AuthModule,
    UsersModule,
    AskModule,
    SharedModule,
    UploadModule,
    ProjectManagementModule,
  ],
  controllers: [AppController, AskController],
  providers: [AppService, AskService, AskGateway, JwtGuard],
})
export class AppModule { }
