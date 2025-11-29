/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import { RegisterDto } from "./dto/register.dto";
import { comparePassword, hashPassword, tryDecodeJwt } from "./utils";
import { LoginDto } from "./dto/login.dto";
import * as bcrypt from "bcrypt";

const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaClient, public jwtService: JwtService) {}

  private async hashToken(token: string) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(token, salt);
  }

  private async compareToken(hash: string, token: string) {
    return bcrypt.compare(token, hash);
  }

  async generateTokens(userId: string, extra: Record<string, any> = {}) {
    const payload = { sub: userId, userId, ...extra };
    const accessToken = this.jwtService.sign(payload, { expiresIn: "1d" });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: "7d" });
    return { accessToken, refreshToken };
  }

  async saveRefreshToken(userId: string, refreshToken: string) {
    const hashed = await this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hashed, refreshTokenExpiresAt: expiresAt },
    });
  }

  async revokeRefreshToken(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null, refreshTokenExpiresAt: null },
    });
  }

  async refreshTokens(userId: string, providedRefreshToken: string) {
    // verify the jwt first
    let payload: any;
    try {
      payload = this.jwtService.verify(providedRefreshToken);
    } catch (e) {
      return null;
    }

    if (!payload || (payload.sub !== userId && payload.userId !== userId))
      return null;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshTokenHash) return null;

    if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date())
      return null;

    const match = await this.compareToken(
      user.refreshTokenHash,
      providedRefreshToken
    );
    if (!match) return null;

    // rotation: issue new tokens and replace stored hash
    const { accessToken, refreshToken } = await this.generateTokens(userId);

    const accessPayload = tryDecodeJwt(accessToken);
    const refreshPayload = tryDecodeJwt(refreshToken);

    // save new refresh token hash + expiry
    await this.saveRefreshToken(userId, refreshToken);

    await this.prisma.user.update({
      where: { id: userId },
      data: { session_token: accessToken },
    });

    const teamMember: any = await this.prisma.teamMember.findFirst({
      where: { userId },
    });
    if (!teamMember) throw new UnauthorizedException("Invalid credentials");

    return {
      token: accessToken,
      refreshToken: refreshToken,
      user,
      teamMember,
    };
  }

  // ---------------- existing methods (adapted to return refresh token) ----------------
  async createOrGetAnonymousUser(clientUserId?: string) {
    let user;

    if (clientUserId) {
      user = await this.prisma.user.findUnique({ where: { id: clientUserId } });
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: { id: clientUserId || undefined },
      });
      // console.log("Created new anonymous user:", user.id);
    } else {
      // console.log("Existing user found:", user.id);
    }

    // generate tokens (access + refresh)
    const tokens = await this.generateTokens(user.id);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    // save current session token (access) for quick validateUser compat
    await this.prisma.user.update({
      where: { id: user.id },
      data: { session_token: tokens.accessToken },
    });

    return {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
    };
  }

  async register(dto: RegisterDto) {
    const { clientTempId, workspace, email, name, role, photo, password } = dto;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Email already registered");

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const createWorkspace = await tx.workspace.create({
          data: { name: workspace, createdAt: new Date() },
        });

        const hashed = password ? hashPassword(password) : undefined;
        const user = await tx.user.create({
          data: { email, name, password: hashed },
          select: {
            id: true,
            name: true,
            phone: true,
            photo: true,
            email: true,
            members: true,
          },
        });

        const teamMember = await tx.teamMember.create({
          data: {
            userId: user.id,
            workspaceId: createWorkspace.id,
            name,
            email,
            role: role ?? null,
            photo: photo ?? null,
            isAdmin: true,
            createdAt: new Date(),
          },
        });

        return { user, teamMember, workspace: createWorkspace };
      });

      // issue tokens and save refresh
      const tokens = await this.generateTokens(result.user.id);
      await this.saveRefreshToken(result.user.id, tokens.refreshToken);

      // Save access token in session_token for compat
      await this.prisma.user.update({
        where: { id: result.user.id },
        data: { session_token: tokens.accessToken },
      });

      return {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: result.user,
        teamMember: result.teamMember,
        workspace: result.workspace,
        clientTempId,
      };
    } catch (err: any) {
      if (err.code === "P2002")
        throw new ConflictException("Unique constraint failed");
      throw new InternalServerErrorException("Register failed");
    }
  }

  async login(dto: LoginDto) {
    const { email, password } = dto as any;
    if (!email) throw new UnauthorizedException("Invalid credentials");

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        phone: true,
        photo: true,
        email: true,
        members: true,
        password: true,
      },
    });

    if (!user) throw new UnauthorizedException("Invalid credentials");
    if (!user.password) throw new UnauthorizedException("Invalid credentials");

    const ok = comparePassword(password || "", user.password);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    const teamMember: any = await this.prisma.teamMember.findFirst({
      where: { email },
    });
    if (!teamMember) throw new UnauthorizedException("Invalid credentials");

    const tokens = await this.generateTokens(user.id);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { session_token: tokens.accessToken },
    });

    if ("password" in user) {
      delete (user as any).password;
    }

    return {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
      teamMember,
    };
  }

  async validateUser(token: string) {
    try {
      const payload: any = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId ?? payload.sub },
      });
      if (!user || user.session_token !== token) return null;
      return user;
    } catch {
      return null;
    }
  }
}
