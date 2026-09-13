import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export const SKIP_GYM_SCOPE_KEY = 'skipGymScope';

/**
 * Global guard, registered AFTER JwtAuthGuard in AppModule so req.user is already
 * populated. (Nest runs global guards in registration order, and global guards run
 * before controller-level ones — so this must not depend on a controller-level
 * JwtAuthGuard, or it silently no-ops.)
 */
@Injectable()
export class GymScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(SKIP_GYM_SCOPE_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return true; // non-HTTP context or a route JwtAuthGuard let through unauthenticated

    if (user.role === 'SUPER_ADMIN') return true; // super admin crosses gym boundaries

    if (!user.gymId) throw new ForbiddenException('No gym context — cannot access gym-scoped resource');

    // Attach gymId directly on the request for downstream use
    req.gymId = user.gymId;
    return true;
  }
}
