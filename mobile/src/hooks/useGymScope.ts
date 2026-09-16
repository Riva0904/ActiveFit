import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useGymContextStore } from '../store/gymContextStore';
import { effectiveGymId, isDrilldown, scopedParams, scopedKey } from '../lib/gymScope';

/**
 * The gym the current screen acts on, and helpers to keep every request and
 * cache entry tied to it.
 *
 * For a gym admin this is always their own gym and `params`/`key` are
 * pass-throughs, so admin screens behave exactly as before. For a super admin it
 * is whichever gym they drilled into.
 */
export function useGymScope() {
  const user = useAuthStore((s) => s.user);
  const selectedGym = useGymContextStore((s) => s.selectedGym);
  const clearSelectedGym = useGymContextStore((s) => s.clearSelectedGym);
  const queryClient = useQueryClient();

  const gymId = effectiveGymId(user, selectedGym?.id);
  const drilldown = isDrilldown(user, selectedGym?.id);

  const params = useCallback(
    (extra: Record<string, unknown> = {}) => scopedParams(user, selectedGym?.id, extra),
    [user, selectedGym?.id],
  );

  const key = useCallback(
    (base: ReadonlyArray<unknown>) => scopedKey(base, gymId),
    [gymId],
  );

  /** Leaving a gym must drop its cache, or the next gym renders the last one's rows. */
  const exitGym = useCallback(() => {
    clearSelectedGym();
    queryClient.removeQueries();
  }, [clearSelectedGym, queryClient]);

  return useMemo(
    () => ({ gymId, gymName: selectedGym?.name ?? null, isDrilldown: drilldown, params, key, exitGym }),
    [gymId, selectedGym?.name, drilldown, params, key, exitGym],
  );
}
