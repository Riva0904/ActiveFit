import { ForbiddenException } from '@nestjs/common';

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
