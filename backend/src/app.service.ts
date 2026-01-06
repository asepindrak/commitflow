import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHello(): string {
    return `CommitFlow API (1.2.1) is running!`;
  }
}
