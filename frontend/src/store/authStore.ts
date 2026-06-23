import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect, useState } from 'react';
import { disconnectSocket } from '@/lib/socket';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'GYM_ADMIN' | 'STAFF' | 'TRAINER' | 'MEMBER';
  avatar?: string;
  gymId?: string;
  phone?: string;
  qrCode?: string;
  memberCode?: string;
  timezone?: string;
}

interface AuthState {
  user: User | null;
  setAuth: (user: User) => void;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      // Token is managed as an httpOnly cookie by the backend — never stored in JS
      setAuth: (user) => {
        disconnectSocket();
        set({ user });
      },
      logout: () => {
        disconnectSocket();
        set({ user: null });
      },
      updateUser: (data) => set((state) => ({ user: state.user ? { ...state.user, ...data } : null })),
    }),
    { name: 'activeboost-auth', partialize: (state) => ({ user: state.user }) },
  ),
);

// Zustand's `persist` middleware hydrates from localStorage asynchronously after mount.
// Any effect that checks `!user` to redirect-if-unauthenticated will see a false null on
// the very first render and bounce a logged-in user to /login (which then bounces again
// off middleware once the cookie is seen) before hydration finishes. Gate those checks on
// this hook instead of trusting `user` alone on first render.
export function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) { setHydrated(true); return; }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}
