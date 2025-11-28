// src/common/guards/jwt.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@prisma/client";
import { tryDecodeJwt } from "src/auth/utils";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "src/auth/public.decorator";

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaClient,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // If route marked public, skip guard
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers["authorization"] || "";
    const token =
      typeof authHeader === "string"
        ? authHeader.replace(/^Bearer\s+/i, "")
        : "";

    if (!token) {
      console.error("[JwtGuard] No token supplied");
      throw new UnauthorizedException("No token");
    }

    try {
      const payload: any = this.jwtService.verify(token);

      const userId = payload.sub ?? payload.userId;
      if (!userId) {
        console.error("[JwtGuard] payload missing userId/sub", payload);
        throw new UnauthorizedException("Invalid token payload");
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        console.error("[JwtGuard] no user for id", userId);
        throw new UnauthorizedException("Invalid token");
      }

      if (user.session_token && user.session_token !== token) {
        console.warn("[JwtGuard] session_token mismatch for user", userId);
        throw new UnauthorizedException("Invalid token (session mismatch)");
      }

      req.user = payload;
      return true;
    } catch (err: any) {
      if (err?.name === "TokenExpiredError") {
        console.error("[JwtGuard] TokenExpiredError:", {
          serverTime: new Date().toISOString(),
          expiredAt: err.expiredAt ? err.expiredAt.toISOString() : null,
        });
      } else {
        console.error("[JwtGuard] verify error:", err && (err.message ?? err));
      }

      const busted = tryDecodeJwt(token);
      if (busted) {
        console.error(
          "[JwtGuard] token (unverified) iat/exp:",
          busted.iat,
          busted.exp,
          "expDate:",
          busted.exp ? new Date(busted.exp * 1000).toISOString() : null
        );
      }

      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
