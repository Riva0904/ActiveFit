/**
 * Which gym a request acts on.
 *
 * Only a super admin can be "in" a gym other than their own, and only by
 * selecting one. For every other role the selection is ignored rather than
 * merged, so a stale selection can never redirect a gym admin's request at
 * someone else's tenant.
 *
 * Pure and RN-free — see roles.ts for why.
 */

export interface ScopedUser {
  role?: string | null;
  gymId?: string | null;
}

export function effectiveGymId(user: ScopedUser | null | undefined, selectedGymId?: string | null): string | null {
  if (!user) return null;
  if (user.role === 'SUPER_ADMIN') return selectedGymId ?? null;
  return user.gymId ?? null;
}

/** True only while a super admin is looking at a specific gym. */
export function isDrilldown(user: ScopedUser | null | undefined, selectedGymId?: string | null): boolean {
  return user?.role === 'SUPER_ADMIN' && !!selectedGymId;
}

/**
 * Query params for a scoped request. `gymId` is added only during a drill-down;
 * for everyone else the key is absent entirely, not undefined, so it can never
 * be serialised onto the URL.
 */
export function scopedParams(
  user: ScopedUser | null | undefined,
  selectedGymId: string | null | undefined,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  if (!isDrilldown(user, selectedGymId)) return { ...extra };
  return { ...extra, gymId: selectedGymId };
}

/**
 * Namespaces a react-query key by gym.
 *
 * Without this, a super admin who views gym A, exits, then views gym B is
 * served gym A's cached rows under gym B's header — and may act on them.
 */
export function scopedKey(base: ReadonlyArray<unknown>, gymId: string | null | undefined): unknown[] {
  return [...base, gymId ?? 'none'];
}
