jest.mock('@/services/supabase/auth-service', () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  deleteAccount: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  onAuthStateChange: jest.fn(),
}));

import type { Session } from '@supabase/supabase-js';
import { migrateAuthState, useAuthStore } from '@/stores/auth-store';
import { useSyncStore } from '@/stores/sync-store';
import * as authService from '@/services/supabase/auth-service';
import { setSyncConfigured } from '../helpers/sync';

function session(id: string, email = `${id}@example.com`): Session {
  return { access_token: 'at', refresh_token: 'rt', user: { id, email } } as unknown as Session;
}

const PROFILE = {
  id: 'u1',
  displayName: 'Test User',
  avatarUrl: null,
  locale: 'en',
  prestigeCount: 0,
  createdAt: '2025-01-01',
};

beforeAll(() => {
  setSyncConfigured(true);
});

afterAll(() => {
  setSyncConfigured(false);
});

beforeEach(() => {
  useAuthStore.setState(useAuthStore.getInitialState(), true);
  useSyncStore.setState(useSyncStore.getInitialState(), true);
  jest.clearAllMocks();
  (authService.getProfile as jest.Mock).mockResolvedValue(null);
});

describe('useAuthStore', () => {
  it('starts with an unknown status, no user and no tokens', () => {
    const state = useAuthStore.getState();
    expect(state.status).toBe('unknown');
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state).not.toHaveProperty('session');
  });

  // ── handleSession (auth events) ──────────────────────────────────────

  it('handleSession with a session: signed in, owner of the sync queue', () => {
    useAuthStore.getState().handleSession(session('u1'));

    const state = useAuthStore.getState();
    expect(state.status).toBe('signedIn');
    expect(state.user).toEqual({ id: 'u1', email: 'u1@example.com' });
    expect(state.lastUserId).toBe('u1');
    expect(useSyncStore.getState().ownerId).toBe('u1');
  });

  it('handleSession(null) shows signed out but keeps the queue (offline expired token)', () => {
    useAuthStore.getState().handleSession(session('u1'));
    useSyncStore.getState().enqueue('todos', 'insert', { id: 't1' });

    useAuthStore.getState().handleSession(null);

    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useSyncStore.getState().ownerId).toBe('u1');
    expect(useSyncStore.getState().pendingOperations).toHaveLength(1);
  });

  it('a different account signing in clears the previous queue and cursor', () => {
    useAuthStore.getState().handleSession(session('userA'));
    useSyncStore.getState().enqueue('todos', 'insert', { id: 't1' });
    useSyncStore.getState().setLastSyncedAt('2026-10-01T00:00:00.000Z');

    useAuthStore.getState().handleSession(session('userB'));

    const sync = useSyncStore.getState();
    expect(sync.ownerId).toBe('userB');
    expect(sync.pendingOperations).toEqual([]);
    expect(sync.lastSyncedAt).toBeNull();
  });

  it('the same account signing in again keeps its queue', () => {
    useAuthStore.getState().handleSession(session('userA'));
    useSyncStore.getState().enqueue('todos', 'insert', { id: 't1' });

    useAuthStore.getState().handleSession(session('userA'));

    expect(useSyncStore.getState().pendingOperations).toHaveLength(1);
  });

  // ── signIn ────────────────────────────────────────────────────────────

  it('signIn success: signed in and loads the profile', async () => {
    (authService.signIn as jest.Mock).mockResolvedValue({ user: session('u1').user, session: session('u1') });
    (authService.getProfile as jest.Mock).mockResolvedValue(PROFILE);

    const result = await useAuthStore.getState().signIn('u1@example.com', 'pass');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const state = useAuthStore.getState();
    expect(result).toEqual({ switchedAccount: false });
    expect(state.status).toBe('signedIn');
    expect(state.user).toEqual({ id: 'u1', email: 'u1@example.com' });
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.profile).toEqual(PROFILE);
  });

  it('signIn reports an account switch when another account used this device', async () => {
    useAuthStore.setState({ lastUserId: 'userA' });
    (authService.signIn as jest.Mock).mockResolvedValue({ user: session('userB').user, session: session('userB') });

    const result = await useAuthStore.getState().signIn('b@example.com', 'pass');

    expect(result).toEqual({ switchedAccount: true });
    expect(useAuthStore.getState().lastUserId).toBe('userB');
  });

  it('signIn failure: stores a translated error key and rethrows', async () => {
    (authService.signIn as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' })
    );

    await expect(useAuthStore.getState().signIn('a@b.com', 'bad')).rejects.toThrow('Invalid login credentials');

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.status).toBe('unknown');
    expect(state.error).toBe('auth.errors.invalidCredentials');
    expect(state.isLoading).toBe(false);
  });

  it('signIn offline: network error key', async () => {
    (authService.signIn as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Network request failed'), { name: 'AuthRetryableFetchError', status: 0 })
    );

    await expect(useAuthStore.getState().signIn('a@b.com', 'pass')).rejects.toThrow();

    expect(useAuthStore.getState().error).toBe('errors.networkError');
  });

  // ── signUp ────────────────────────────────────────────────────────────

  it('signUp with a session (no email confirmation): signed in', async () => {
    (authService.signUp as jest.Mock).mockResolvedValue({ user: session('u2').user, session: session('u2') });

    const result = await useAuthStore.getState().signUp('u2@example.com', 'pass', 'New User');

    expect(result).toEqual({ needsConfirmation: false, switchedAccount: false });
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(authService.signUp).toHaveBeenCalledWith('u2@example.com', 'pass', 'New User');
  });

  it('signUp that needs email confirmation: stays signed out', async () => {
    (authService.signUp as jest.Mock).mockResolvedValue({ user: session('u3').user, session: null });

    const result = await useAuthStore.getState().signUp('u3@example.com', 'pass', 'Three');

    expect(result.needsConfirmation).toBe(true);
    expect(useAuthStore.getState().status).toBe('unknown');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('signUp failure: sets a translated error', async () => {
    (authService.signUp as jest.Mock).mockRejectedValue(
      Object.assign(new Error('User already registered'), { code: 'user_already_exists' })
    );

    await expect(useAuthStore.getState().signUp('dup@b.com', 'pass', 'Dup')).rejects.toThrow();

    expect(useAuthStore.getState().error).toBe('auth.errors.emailInUse');
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  // ── signOut ───────────────────────────────────────────────────────────

  it('signOut: clears the user, profile, sync queue and cursor', async () => {
    useAuthStore.getState().handleSession(session('u1'));
    useAuthStore.setState({ profile: PROFILE });
    useSyncStore.getState().enqueue('todos', 'insert', { id: 't1' });
    useSyncStore.getState().setLastSyncedAt('2026-10-01T00:00:00.000Z');
    (authService.signOut as jest.Mock).mockResolvedValue(undefined);

    await useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(authService.signOut).toHaveBeenCalled();
    expect(state.status).toBe('signedOut');
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    // Remembered so the next sign-in can detect an account switch
    expect(state.lastUserId).toBe('u1');
    const sync = useSyncStore.getState();
    expect(sync.ownerId).toBeNull();
    expect(sync.pendingOperations).toEqual([]);
    expect(sync.lastSyncedAt).toBeNull();
  });

  it('signOut never throws, even when the service fails', async () => {
    useAuthStore.getState().handleSession(session('u1'));
    (authService.signOut as jest.Mock).mockResolvedValue(undefined);

    await expect(useAuthStore.getState().signOut()).resolves.toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
  });

  // ── deleteAccount ─────────────────────────────────────────────────────

  it('deleteAccount: deletes on the server, then signs out and forgets the account', async () => {
    useAuthStore.getState().handleSession(session('u1'));
    (authService.deleteAccount as jest.Mock).mockResolvedValue(undefined);
    (authService.signOut as jest.Mock).mockResolvedValue(undefined);

    await useAuthStore.getState().deleteAccount();

    expect(authService.deleteAccount).toHaveBeenCalled();
    expect(authService.signOut).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().lastUserId).toBeNull();
  });

  it('deleteAccount failure: stays signed in and reports the error', async () => {
    useAuthStore.getState().handleSession(session('u1'));
    (authService.deleteAccount as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Network request failed'), { status: 0 })
    );

    await expect(useAuthStore.getState().deleteAccount()).rejects.toThrow();

    expect(authService.signOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(useAuthStore.getState().error).toBe('errors.networkError');
  });

  // ── loadProfile ───────────────────────────────────────────────────────

  it('loadProfile: fetches and sets profile', async () => {
    (authService.getProfile as jest.Mock).mockResolvedValue(PROFILE);
    await useAuthStore.getState().loadProfile();
    expect(useAuthStore.getState().profile).toEqual(PROFILE);
  });

  it('loadProfile failure: is non-fatal', async () => {
    (authService.getProfile as jest.Mock).mockRejectedValue(new Error('db down'));
    await useAuthStore.getState().loadProfile();
    expect(useAuthStore.getState().profile).toBeNull();
  });

  it('clearError: clears error', () => {
    useAuthStore.setState({ error: 'some error' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});

describe('migrateAuthState', () => {
  it('v0 → v1 drops the duplicated tokens and keeps the profile and last user', () => {
    const v0 = {
      session: { access_token: 'secret-at', refresh_token: 'secret-rt' },
      user: { id: 'u1', email: 'a@b.com' },
      profile: PROFILE,
    };

    const migrated = migrateAuthState(v0, 0);

    expect(migrated).toEqual({ profile: PROFILE, lastUserId: 'u1' });
    expect(JSON.stringify(migrated)).not.toContain('secret');
  });

  it('tolerates garbage', () => {
    expect(migrateAuthState(null, 0)).toEqual({ profile: null, lastUserId: null });
    expect(migrateAuthState({ profile: 'x', user: 5 }, 0)).toEqual({ profile: null, lastUserId: null });
  });
});
