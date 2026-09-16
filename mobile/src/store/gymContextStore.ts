import { create } from 'zustand';

export interface SelectedGym {
  id: string;
  name: string;
  logo?: string | null;
}

interface GymContextState {
  /** The gym a super admin is currently looking at. Null at the platform level. */
  selectedGym: SelectedGym | null;
  setSelectedGym: (gym: SelectedGym) => void;
  clearSelectedGym: () => void;
}

/**
 * Which tenant a super admin is acting on.
 *
 * Deliberately in-memory: persisting it would resume the app inside a gym the
 * operator picked days ago, which is exactly the state in which someone edits
 * the wrong gym's books. Cleared on logout.
 */
export const useGymContextStore = create<GymContextState>((set) => ({
  selectedGym: null,
  setSelectedGym: (gym) => set({ selectedGym: gym }),
  clearSelectedGym: () => set({ selectedGym: null }),
}));
