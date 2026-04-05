import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UserProfile } from '@/types/auth.types';
import * as authService from '@/services/supabase/auth-service';

interface AuthStore {
  // State
  user: { id: string; email?: string } | null;
  profile: UserProfile | null;
  session: { access_token: string; refresh_token: string } | null;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;

  // Actions
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
  setSession: (session: { access_token: string; refresh_token: string } | null) => void;
  setUser: (user: { id: string; email?: string } | null) => void;
  setHydrated: (value: boolean) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      session: null,
      isLoading: false,
      isHydrated: false,
      error: null,

      signUp: async (email, password, displayName) => {
        set({ isLoading: true, error: null });
        try {
          const { user, session } = await authService.signUp(email, password, displayName);
          set({
            user: user ? { id: user.id, email: user.email } : null,
            session: session
              ? { access_token: session.access_token, refresh_token: session.refresh_token }
              : null,
            isLoading: false,
          });
          if (user) await get().loadProfile();
        } catch (e: unknown) {
          set({ isLoading: false, error: (e as Error).message });
          throw e;
        }
      },

      signIn: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { user, session } = await authService.signIn(email, password);
          set({
            user: user ? { id: user.id, email: user.email } : null,
            session: session
              ? { access_token: session.access_token, refresh_token: session.refresh_token }
              : null,
            isLoading: false,
          });
          if (user) await get().loadProfile();
        } catch (e: unknown) {
          set({ isLoading: false, error: (e as Error).message });
          throw e;
        }
      },

      signOut: async () => {
        try {
          await authService.signOut();
        } finally {
          set({ user: null, profile: null, session: null, error: null });
        }
      },

      loadProfile: async () => {
        try {
          const profile = await authService.getProfile();
          set({ profile });
        } catch {
          // Profile load failure is non-fatal
        }
      },

      setSession: (session) => set({ session }),
      setUser: (user) => set({ user }),
      setHydrated: (value) => set({ isHydrated: value }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        session: state.session,
        user: state.user,
        profile: state.profile,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
