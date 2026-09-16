import { useAuthStore } from '../store/authStore';
import { useGymContextStore } from '../store/gymContextStore';

/**
 * Whose gym the current screen belongs to.
 *
 * Members, trainers, staff and gym admins see their own gym's name. A super
 * admin sees the platform, or the gym they have drilled into — never a blank.
 */
export function useGymIdentity(): { name: string | null; logo: string | null } {
  const user = useAuthStore((s) => s.user);
  const selectedGym = useGymContextStore((s) => s.selectedGym);

  if (user?.role === 'SUPER_ADMIN') {
    if (selectedGym) return { name: selectedGym.name, logo: selectedGym.logo ?? null };
    return { name: 'ActiveBoost Platform', logo: null };
  }

  return { name: user?.gym?.name ?? null, logo: user?.gym?.logo ?? null };
}
