// src/common/guards/session.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
globalThis.__sessions = globalThis.__sessions || new Map<string, number>();

@Injectable()
export class SessionGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest();
        const token = req.headers['x-session-token'];
        console.log(`[SessionGuard] Active sessions: ${Array.from(globalThis.__sessions.keys()).join(', ')}`);
        const sessions = globalThis.__sessions;

        if (!token || !sessions.has(token)) {
            throw new UnauthorizedException('Invalid session token');
        }

        const expires = sessions.get(token)!;
        if (Date.now() > expires) {
            sessions.delete(token);
            throw new UnauthorizedException('Session expired');
        }

        return true;
    }

    static addSession(token: string, ttlMs = 10 * 60 * 1000) {
        globalThis.__sessions.set(token, Date.now() + ttlMs);
        console.log(`[SessionGuard] Added token ${token}`);
    }
}
