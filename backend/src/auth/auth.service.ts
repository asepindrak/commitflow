// src/auth/auth.service.ts
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import { RegisterDto } from "./dto/register.dto";
import { comparePassword, hashPassword } from "./utils";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaClient, private jwtService: JwtService) {}

  async createOrGetAnonymousUser(clientUserId?: string) {
    let user;

    if (clientUserId) {
      // cek apakah user dengan id FE ini sudah ada
      user = await this.prisma.user.findUnique({ where: { id: clientUserId } });
    }

    if (!user) {
      // kalau belum ada, buat user baru pakai id dari FE atau generate baru
      user = await this.prisma.user.create({
        data: {
          id: clientUserId || undefined, // kalau undefined, Prisma buatkan sendiri
        },
      });
      console.log("Created new anonymous user:", user.id);
    } else {
      console.log("Existing user found:", user.id);
    }

    // bikin JWT
    const jwt = this.jwtService.sign({ userId: user.id });

    // simpan JWT di DB
    await this.prisma.user.update({
      where: { id: user.id },
      data: { session_token: jwt },
    });

    return { token: jwt, user };
  }

  async register(dto: RegisterDto) {
    const { clientTempId, workspace, email, name, role, photo, password } = dto;

    // Basic uniqueness check
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Email already registered");

    // Use transaction to create TeamMember then User referencing member.id
    try {
      console.log(workspace);
      const result = await this.prisma.$transaction(async (tx) => {
        // 1) create Workspace first
        const createWorkspace = await tx.workspace.create({
          data: {
            name: workspace,
            createdAt: new Date(),
          },
        });

        // 2) create User referencing
        const hashed = password ? hashPassword(password) : undefined;
        const user = await tx.user.create({
          data: {
            email,
            name,
            password: hashed,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            photo: true,
            email: true,
            members: true,
          },
        });

        // 3) create TeamMember
        const teamMember = await tx.teamMember.create({
          data: {
            userId: user.id,
            workspaceId: createWorkspace.id,
            name,
            email,
            role: role ?? null,
            photo: photo ?? null,
            // optionally store clientTempId if you want mapping
            // clientTempId: clientTempId ?? null  // uncomment if you added field
            createdAt: new Date(),
          },
        });

        return { user, teamMember, workspace: createWorkspace };
      });

      // Create JWT (you can include teamMemberId in payload too)
      const jwt = this.jwtService.sign({
        userId: result.user.id,
        teamMemberId: result.teamMember.id,
      });
      // Save token to user
      await this.prisma.user.update({
        where: { id: result.user.id },
        data: { session_token: jwt },
      });

      // Return both ids so FE dapat mapping optimistic
      return {
        token: jwt,
        user: result.user,
        teamMember: result.teamMember,
        teamMemberId: result.teamMember.id,
        workspace: result.workspace,
        // optionally map clientTempId => memberId so FE can replace optimistic id
        clientTempId,
      };
    } catch (err) {
      if (err.code === "P2002")
        throw new ConflictException("Unique constraint failed");
      throw new InternalServerErrorException("Register failed");
    }
  }

  // src/auth/auth.service.ts (login portion — replace or extend existing)
  async login(dto: LoginDto) {
    const { email, password } = dto as any;
    if (!email) throw new UnauthorizedException("Invalid credentials");

    // find user and include relation if exists
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

    // find user and include relation if exists
    const teamMember: any = await this.prisma.teamMember.findFirst({
      where: { email },
    });

    if (!teamMember) throw new UnauthorizedException("Invalid credentials");

    const jwt = this.jwtService.sign({
      userId: user?.id,
      teamMemberId: teamMember.id,
    });

    await this.prisma.user.update({
      where: { id: user?.id },
      data: { session_token: jwt },
    });

    // Ensure password property is possibly undefined before delete, and avoid type error
    if ("password" in user) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      delete (user as any).password;
    }

    return { token: jwt, user, teamMember, teamMemberId: teamMember.id };
  }

  async validateUser(token: string) {
    try {
      const payload: any = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user || user.session_token !== token) return null;
      return user;
    } catch {
      return null;
    }
  }
}
