// src/auth/auth.controller.ts
import { Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("anon")
  async anonLogin(@Body("userId") userId?: string) {
    const { token, user } = await this.authService.createOrGetAnonymousUser(
      userId
    );
    return { token, userId: user.id }; // kirim userId juga
  }

  @Post("register")
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    // return mapping so FE bisa replace optimistic client id with real teamMember.id
    return {
      token: result.token,
      userId: result.user.id,
      workspaceId: result.workspace.id,
      teamMemberId: result.teamMember.id,
      clientTempId: result.clientTempId ?? null,
    };
  }

  @Post("login")
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    if (!result) throw new UnauthorizedException("Invalid credentials");
    // return similar shape as register (token + user + optional member)
    return {
      token: result.token,
      userId: result?.user?.id ?? "",
    };
  }
}
