/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  Req,
  Res,
  HttpCode,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import type { Request, Response } from "express";
import { Public } from "./public.decorator";

const REFRESH_COOKIE_NAME = "refresh_token";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// Environment-aware cookie options
const isProd = process.env.NODE_ENV === "production";
const FE_URL =
  process.env.FE_URL || process.env.FRONTEND_ORIGIN || "http://localhost:3000";
const BACKEND_ORIGIN =
  process.env.BACKEND_ORIGIN || `http://localhost:${process.env.PORT || 8000}`;
const isCrossOrigin = FE_URL !== BACKEND_ORIGIN;

// For cross-origin cookies in production you MUST use sameSite: 'none' AND secure: true.
// For local dev over HTTP, browsers disallow SameSite=None without Secure, so we fall back to 'lax'.
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd, // true in production (HTTPS)
  sameSite: isProd && isCrossOrigin ? ("none" as const) : ("lax" as const),
  path: "/",
};

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post("anon")
  async anonLogin(
    @Body("userId") userId?: string,
    @Res({ passthrough: true }) res?: Response
  ) {
    const result = await this.authService.createOrGetAnonymousUser(userId);

    // if service returned a refreshToken, set it as httpOnly cookie
    if (result?.refreshToken && res) {
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: COOKIE_MAX_AGE,
      });
    }

    // keep the same response shape you had before
    return { token: result.token, userId: result.user.id };
  }

  @Public()
  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res?: Response
  ) {
    const result = await this.authService.register(dto);

    // if service returned a refreshToken, set cookie
    if (result?.refreshToken && res) {
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: COOKIE_MAX_AGE,
      });
    }

    // keep your existing response mapping
    return {
      token: result.token,
      userId: result.user.id,
      user: result.user,
      workspaceId: result.workspace.id,
      clientTempId: result.clientTempId ?? null,
    };
  }

  @Public()
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res?: Response
  ) {
    const result = await this.authService.login(dto);
    if (!result) throw new UnauthorizedException("Invalid credentials");

    // set refresh cookie if present (service should ideally return refreshToken)
    if (result.refreshToken && res) {
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: COOKIE_MAX_AGE,
        // set domain if backend is serving under a hostname different than localhost (optional)
      });
    }

    // return similar shape as before (token + user + optional member)
    return {
      token: result.token,
      userId: result?.user?.id ?? "",
      user: result.user,
    };
  }

  // refresh endpoint: reads refresh_token cookie, verifies, rotates
  @Public()
  @HttpCode(200)
  @Post("refresh")
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
      throw new UnauthorizedException("No refresh token");
    }

    // attempt to verify and refresh via AuthService
    let payload: any;
    try {
      payload = (this.authService as any).jwtService.verify(token);
    } catch (e: any) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const userId = payload.sub;
    const newTokens = await this.authService.refreshTokens(userId, token);
    if (!newTokens) throw new UnauthorizedException("Refresh failed");

    // rotate cookie
    res.cookie(REFRESH_COOKIE_NAME, newTokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: COOKIE_MAX_AGE,
    });

    // return access token
    return {
      token: newTokens.token,
      userId: newTokens?.user?.id ?? "",
      user: newTokens.user,
    };
  }

  @Public()
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      try {
        const payload: any = (this.authService as any).jwtService.verify(token);
        await this.authService.revokeRefreshToken(payload.sub);
      } catch (e: any) {
        // ignore verification errors during logout
        console.log(e);
      }
    }

    // clear cookie with same attributes so browser accepts deletion
    res.clearCookie(REFRESH_COOKIE_NAME, { ...COOKIE_OPTIONS, path: "/" });
    return { ok: true };
  }
}
