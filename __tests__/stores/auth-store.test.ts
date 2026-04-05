jest.mock('@/services/supabase/auth-service', () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  onAuthStateChange: jest.fn(),
}));

import { useAuthStore } from '@/stores/auth-store';
import * as authService from '@/services/supabase/auth-service';

const INITIAL_STATE = {
  user: null,
  profile: null,
  session: null,
  isLoading: false,
  isHydrated: false,
  error: null,
};

beforeEach(() => {
  useAuthStore.setState(INITIAL_STATE);
  jest.clearAllMocks();
});

describe('useAuthStore', () => {
  // ── initial state ─────────────────────────────────────────────────────

  it('initial state has null user, profile, and session', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.session).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  // ── signIn ────────────────────────────────────────────────────────────

  it('signIn success: sets user and session', async () => {
    (authService.signIn as jest.Mock).mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com' },
      session: { access_token: 'at', refresh_token: 'rt' },
    });
    (authService.getProfile as jest.Mock).mockResolvedValue({
      id: 'u1',
      displayName: 'Test',
      avatarUrl: null,
      locale: 'en',
      prestigeCount: 0,
      createdAt: '2025-01-01',
    });

    await useAuthStore.getState().signIn('a@b.com', 'pass');

    const state = useAuthStore.getState();
    expect(state.user).toEqual({ id: 'u1', email: 'a@b.com' });
    expect(state.session).toEqual({ access_token: 'at', refresh_token: 'rt' });
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(authService.getProfile).toHaveBeenCalled();
  });

  it('signIn success: calls loadProfile which sets profile', async () => {
    const mockProfile = {
      id: 'u1',
      displayName: 'Test User',
      avatarUrl: null,
      locale: 'en',
      prestigeCount: 0,
      createdAt: '2025-01-01',
    };
    (authService.signIn as jest.Mock).mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com' },
      session: { access_token: 'at', refresh_token: 'rt' },
    });
    (authService.getProfile as jest.Mock).mockResolvedValue(mockProfile);

    await useAuthStore.getState().signIn('a@b.com', 'pass');

    expect(useAuthStore.getState().profile).toEqual(mockProfile);
  });

  it('signIn failure: sets error and does not set user', async () => {
    (authService.signIn as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));

    await expect(useAuthStore.getState().signIn('a@b.com', 'bad')).rejects.toThrow('Invalid credentials');

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.error).toBe('Invalid credentials');
    expect(state.isLoading).toBe(false);
  });

  it('signIn: does not call loadProfile when user is null', async () => {
    (authService.signIn as jest.Mock).mockResolvedValue({
      user: null,
      session: null,
    });

    await useAuthStore.getState().signIn('a@b.com', 'pass');

    expect(authService.getProfile).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });

  // ── signUp ────────────────────────────────────────────────────────────

  it('signUp success: sets user and session', async () => {
    (authService.signUp as jest.Mock).mockResolvedValue({
      user: { id: 'u2', email: 'new@b.com' },
      session: { access_token: 'at2', refresh_token: 'rt2' },
    });
    (authService.getProfile as jest.Mock).mockResolvedValue(null);

    await useAuthStore.getState().signUp('new@b.com', 'pass', 'New User');

    const state = useAuthStore.getState();
    expect(state.user).toEqual({ id: 'u2', email: 'new@b.com' });
    expect(state.session).toEqual({ access_token: 'at2', refresh_token: 'rt2' });
    expect(state.isLoading).toBe(false);
    expect(authService.signUp).toHaveBeenCalledWith('new@b.com', 'pass', 'New User');
  });

  it('signUp failure: sets error', async () => {
    (authService.signUp as jest.Mock).mockRejectedValue(new Error('Email taken'));

    await expect(
      useAuthStore.getState().signUp('dup@b.com', 'pass', 'Dup')
    ).rejects.toThrow('Email taken');

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.error).toBe('Email taken');
    expect(state.isLoading).toBe(false);
  });

  // ── signOut ───────────────────────────────────────────────────────────

  it('signOut: clears user, profile, and session', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com' },
      profile: { id: 'u1', displayName: 'X', avatarUrl: null, locale: 'en', prestigeCount: 0, createdAt: '' },
      session: { access_token: 'at', refresh_token: 'rt' },
    });
    (authService.signOut as jest.Mock).mockResolvedValue(undefined);

    await useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.session).toBeNull();
    expect(state.error).toBeNull();
  });

  it('signOut: clears state even if authService.signOut throws', async () => {
    useAuthStore.setState({
      user: { id: 'u1' },
      session: { access_token: 'at', refresh_token: 'rt' },
    });
    (authService.signOut as jest.Mock).mockRejectedValue(new Error('network'));

    // signOut rethrows, but state is still cleared in the finally block
    try {
      await useAuthStore.getState().signOut();
    } catch {
      // expected
    }

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
  });

  // ── loadProfile ───────────────────────────────────────────────────────

  it('loadProfile: fetches and sets profile', async () => {
    const mockProfile = {
      id: 'u1',
      displayName: 'Loaded',
      avatarUrl: 'https://example.com/avatar.png',
      locale: 'tr',
      prestigeCount: 2,
      createdAt: '2025-06-01',
    };
    (authService.getProfile as jest.Mock).mockResolvedValue(mockProfile);

    await useAuthStore.getState().loadProfile();

    expect(useAuthStore.getState().profile).toEqual(mockProfile);
  });

  it('loadProfile failure: is non-fatal and does not crash', async () => {
    (authService.getProfile as jest.Mock).mockRejectedValue(new Error('db down'));

    // Should not throw
    await useAuthStore.getState().loadProfile();

    // profile remains unchanged
    expect(useAuthStore.getState().profile).toBeNull();
  });

  // ── setSession ────────────────────────────────────────────────────────

  it('setSession: updates session', () => {
    useAuthStore.getState().setSession({ access_token: 'new-at', refresh_token: 'new-rt' });
    expect(useAuthStore.getState().session).toEqual({ access_token: 'new-at', refresh_token: 'new-rt' });
  });

  // ── setHydrated ───────────────────────────────────────────────────────

  it('setHydrated: updates isHydrated', () => {
    expect(useAuthStore.getState().isHydrated).toBe(false);
    useAuthStore.getState().setHydrated(true);
    expect(useAuthStore.getState().isHydrated).toBe(true);
  });

  // ── clearError ────────────────────────────────────────────────────────

  it('clearError: clears error', () => {
    useAuthStore.setState({ error: 'some error' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});
