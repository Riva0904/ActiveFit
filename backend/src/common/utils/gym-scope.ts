import { BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * Resolves the tenant scope a service call must be restricted to.
 *
 * - SUPER_ADMIN → `undefined` (crosses gym boundaries).
 * - Every other role → their own gymId. A gym-scoped role with no gymId is an
 *   invalid state for a tenant resource, so it is rejected outright rather than
 *   silently widened to "all gyms".
 *
 * Services take the result as an optional `gymId` and add `{ gymId }` to their
 * Prisma `where` only when it is defined.
 */
export function gymScopeOf(user: { role: string; gymId?: string | null }): string | undefined {
  if (user.role === 'SUPER_ADMIN') return undefined;
  if (!user.gymId) throw new ForbiddenException('No gym context — cannot access gym-scoped resource');
  return user.gymId;
}

/** Prisma `where` fragment for the scope returned by gymScopeOf(). */
export function scopedWhere(gymId?: string): { gymId?: string } {
  return gymId ? { gymId } : {};
}

/**
 * Resolves which gym a request acts on when a SUPER_ADMIN may target one
 * explicitly (`?gymId=`), used by the mobile drill-down.
 *
 * Two deliberate properties:
 *  - For every other role `requestedGymId` is **ignored, never validated**. There
 *    is no code path where a GYM_ADMIN's query param reaches Prisma, so no later
 *    refactor can turn this into a privilege escalation.
 *  - A SUPER_ADMIN who did not pick a gym gets a loud 400 rather than a silent
 *    widening to every tenant. Silent widening (`if (gymId) where.gymId = gymId`)
 *    is exactly how the cross-gym leaks in payments and trainers happened.
 */
export function resolveGymScope(
  user: { role: string; gymId?: string | null },
  requestedGymId?: string,
): string {
  if (user.role === 'SUPER_ADMIN') {
    if (!requestedGymId) {
      throw new BadRequestException('gymId is required — choose a gym first');
    }
    return requestedGymId;
  }
  if (!user.gymId) throw new ForbiddenException('No gym context — cannot access gym-scoped resource');
  return user.gymId;
}

/**
 * Same, but lets a SUPER_ADMIN with no selection mean "every gym". Only for the
 * handful of list endpoints where a platform-wide view is the actual intent.
 */
export function resolveGymScopeOptional(
  user: { role: string; gymId?: string | null },
  requestedGymId?: string,
): string | undefined {
  if (user.role === 'SUPER_ADMIN') return requestedGymId || undefined;
  if (!user.gymId) throw new ForbiddenException('No gym context — cannot access gym-scoped resource');
  return user.gymId;
}
