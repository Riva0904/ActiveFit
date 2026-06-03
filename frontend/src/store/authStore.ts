import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
