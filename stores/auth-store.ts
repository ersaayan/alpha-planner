import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAuthErrorKey } from '@/services/supabase/auth-errors';
import * as authService from '@/services/supabase/auth-service';
import type { AuthUser, UserProfile } from '@/types/auth.types';
import { asRecord, createPersistOptions } from './persist';
import { useSyncStore } from './sync-store';

/**
 * Auth only matters in builds with sync configured. The session itself (tokens)
 * lives in the Supabase client's own storage; this store mirrors who is signed in,
 * driven by `supabase.auth.onAuthStateChange` (see hooks/use-app-bootstrap.ts).
 */
export type AuthStatus = 'unknown' | 'signedOut' | 'signedIn';

export interface SignInResult {
  /** True when a different account than the last one on this device signed in. */
  switchedAccount: boolean;
}

export interface SignUpResult extends SignInResult {
  /** True when the server requires email confirmation before the first sign-in. */
  needsConfirmation: boolean;
}

interface AuthStore {
  // State
  status: AuthStatus;
  user: AuthUser | null;
  profile: UserProfile | null;
  /** The last account signed in on this device, kept after sign-out to detect account switches. */
  lastUserId: string | null;
  isLoading: boolean;
  /** i18n key of the last auth error. */
  error: string | null;

  // Actions
  signUp: (email: string, password: string, displayName: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  /** Signs out on this device. Never throws, works offline, and drops the sync queue. */
  signOut: () => Promise<void>;
  /** Deletes the account on the server, then signs out locally. */
  deleteAccount: () => Promise<void>;
  loadProfile: () => Promise<void>;
  /** Applies the session reported by Supabase (auth events). */
  handleSession: (session: Session | null) => void;
  clearError: () => void;
}

function toAuthUser(session: Session | null): AuthUser | null {
  const user = session?.user;
  return user ? { id: user.id, email: user.email } : null;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      status: 'unknown',
      user: null,
      profile: null,
      lastUserId: null,
      isLoading: false,
      error: null,

      signUp: async (email, password, displayName) => {
        const previousUserId = get().lastUserId;
        set({ isLoading: true, error: null });
        try {
          const { session } = await authService.signUp(email, password, displayName);
          if (session) get().handleSession(session);
          set({ isLoading: false });
          const userId = session?.user.id ?? null;
          return {
            needsConfirmation: !session,
            switchedAccount: userId !== null && previousUserId !== null && previousUserId !== userId,
          };
        } catch (e: unknown) {
          set({ isLoading: false, error: getAuthErrorKey(e) });
          throw e;
        }
      },

      signIn: async (email, password) => {
        const previousUserId = get().lastUserId;
        set({ isLoading: true, error: null });
        try {
          const { session } = await authService.signIn(email, password);
          get().handleSession(session);
          set({ isLoading: false });
          const userId = session?.user.id ?? null;
          return { switchedAccount: userId !== null && previousUserId !== null && previousUserId !== userId };
        } catch (e: unknown) {
          set({ isLoading: false, error: getAuthErrorKey(e) });
          throw e;
        }
      },

      signOut: async () => {
        await authService.signOut();
        set({ status: 'signedOut', user: null, profile: null, error: null, isLoading: false });
        // Queued changes belong to the account that just left; never upload them for anyone else.
        useSyncStore.getState().setOwner(null);
      },

      deleteAccount: async () => {
        set({ isLoading: true, error: null });
        try {
          await authService.deleteAccount();
        } catch (e: unknown) {
          set({ isLoading: false, error: getAuthErrorKey(e) });
          throw e;
        }
        await get().signOut();
        set({ lastUserId: null });
      },

      loadProfile: async () => {
        try {
          const profile = await authService.getProfile();
          set({ profile });
        } catch {
          // Profile load failure is non-fatal
        }
      },

      handleSession: (session) => {
        const user = toAuthUser(session);
        if (!user) {
          // A null session is not always a sign-out: offline with an expired token,
          // Supabase reports no session but keeps it stored and refreshes later.
          // So only update what the UI shows; the sync queue is kept for that user.
          set({ status: 'signedOut', user: null });
          return;
        }
        const previous = get();
        set({
          status: 'signedIn',
          user,
          lastUserId: user.id,
          profile: previous.profile?.id === user.id ? previous.profile : null,
        });
        // A different account clears the queue and cursor of the previous one.
        useSyncStore.getState().setOwner(user.id);
        if (previous.profile?.id !== user.id) {
          // Outside the auth callback: Supabase advises against awaiting its calls in there.
          setTimeout(() => {
            void get().loadProfile();
          }, 0);
        }
      },

      clearError: () => set({ error: null }),
    }),
    createPersistOptions<AuthStore, Pick<AuthStore, 'profile' | 'lastUserId'>>({
      name: 'auth-store',
      version: 1,
      partialize: (state) => ({ profile: state.profile, lastUserId: state.lastUserId }),
      migrate: migrateAuthState,
    })
  )
);

/**
 * v0 → v1. v0 duplicated the access and refresh tokens here; they are dropped
 * (the Supabase client keeps its own session) and only the profile cache and the
 * last signed-in user id survive.
 */
export function migrateAuthState(persisted: unknown, _fromVersion: number) {
  const state = asRecord(persisted);
  const profile = asRecord(state.profile);
  const lastUserId =
    typeof state.lastUserId === 'string'
      ? state.lastUserId
      : typeof asRecord(state.user).id === 'string'
        ? (asRecord(state.user).id as string)
        : null;
  return {
    profile: typeof profile.id === 'string' ? profile : null,
    lastUserId,
  };
}
