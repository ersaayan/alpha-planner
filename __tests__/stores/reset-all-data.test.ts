jest.mock('@/services/supabase/auth-service', () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn().mockResolvedValue(undefined),
  deleteAccount: jest.fn(),
  getProfile: jest.fn().mockResolvedValue(null),
  updateProfile: jest.fn(),
  onAuthStateChange: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import * as authService from '@/services/supabase/auth-service';
import { changeLanguage } from '@/services/i18n/i18n-config';
import { useAuthStore } from '@/stores/auth-store';
import { useCategoryStore } from '@/stores/category-store';
import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { useGamificationStore } from '@/stores/gamification-store';
import { whenStoresHydrated } from '@/stores/hydration';
import { backupKey } from '@/stores/persist';
import { usePomodoroStore } from '@/stores/pomodoro-store';
import { resetAllData } from '@/stores/reset-all-data';
import { useSettingsStore } from '@/stores/settings-store';
import { useSyncStore } from '@/stores/sync-store';
import { useTodoStore } from '@/stores/todo-store';
import { useWeeklyGoalsStore } from '@/stores/weekly-goals-store';
import { DEFAULT_APP_SETTINGS, DEFAULT_POMODORO_SETTINGS, INITIAL_TIMER_STATE } from '@/types';
import { setSyncConfigured } from '../helpers/sync';

type Storage = { __INTERNAL_MOCK_STORAGE__: Record<string, string> };
const disk = () => (AsyncStorage as unknown as Storage).__INTERNAL_MOCK_STORAGE__;

function session(id: string): Session {
  return { access_token: 'at', refresh_token: 'rt', user: { id, email: `${id}@x.com` } } as unknown as Session;
}

async function fillEveryStore() {
  setSyncConfigured(true);
  useAuthStore.getState().handleSession(session('user-1'));
  useAuthStore.setState({ profile: { id: 'user-1', displayName: 'Me', avatarUrl: null, locale: 'tr', prestigeCount: 0, createdAt: '' } });

  useSettingsStore.getState().updateSettings({ theme: 'dark', language: 'tr' });
  useSettingsStore.getState().completeOnboarding();
  useSettingsStore.getState().updatePomodoroSettings({ focusDuration: 3000 });

  useCategoryStore.getState().initializeCategories();
  useCategoryStore.getState().addCategory({ name: 'Mine', color: '#E57373', icon: 'folder-outline', order: 5 });

  useTodoStore.getState().addTodo({
    title: 'Secret plan',
    description: null,
    dueDate: null,
    status: 'pending',
    categoryId: null,
    priority: 'medium',
    estimatedPomodoros: null,
    completedAt: null,
    order: 0,
  });

  useGamificationStore.getState().addXp(500);
  useGamificationStore.setState((state) => ({
    combo: { ...state.combo, sessionCombo: 3, dailyComboStreak: 4 },
    prestige: { ...state.prestige, count: 2 },
  }));
  useDailyQuestsStore.getState().ensureTodayQuests();
  useDailyQuestsStore.setState((state) => ({ quests: state.quests.map((q) => ({ ...q, currentValue: 1 })) }));
  useWeeklyGoalsStore.getState().ensureThisWeekGoals();
  useWeeklyGoalsStore.getState().setPersonalGoal('pomodoros', 99);

  usePomodoroStore.setState({ sessions: [{ id: 'p1' } as never] });

  disk()[backupKey('todo-storage')] = 'old corrupt copy';
}

beforeAll(async () => {
  await whenStoresHydrated();
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  setSyncConfigured(false);
});

describe('resetAllData', () => {
  it('returns every store to its first-launch state', async () => {
    await fillEveryStore();
    expect(useSyncStore.getState().pendingOperations.length).toBeGreaterThan(0);

    await useSettingsStore.getState().resetAllData();

    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(useSettingsStore.getState().pomodoroSettings).toEqual(DEFAULT_POMODORO_SETTINGS);
    expect(useTodoStore.getState().todos).toEqual([]);

    const gamification = useGamificationStore.getState();
    expect(gamification.stats.totalXp).toBe(0);
    expect(gamification.unlockedAchievements).toEqual([]);
    expect(gamification.combo.sessionCombo).toBe(0);
    expect(gamification.combo.dailyComboStreak).toBe(0);
    expect(gamification.prestige.count).toBe(0);
    expect(gamification.prestige.history).toEqual([]);

    expect(useWeeklyGoalsStore.getState().goals.some((g) => g.goalType === 'personal')).toBe(false);
    expect(useDailyQuestsStore.getState().quests.every((q) => q.currentValue === 0)).toBe(true);

    const sync = useSyncStore.getState();
    expect(sync.pendingOperations).toEqual([]);
    expect(sync.lastSyncedAt).toBeNull();
    expect(sync.ownerId).toBeNull();

    const auth = useAuthStore.getState();
    expect(auth.profile).toBeNull();
    expect(auth.lastUserId).toBeNull();
    expect(auth.user).toBeNull();
    expect(authService.signOut).toHaveBeenCalled();

    expect(usePomodoroStore.getState().sessions).toEqual([]);
    expect(usePomodoroStore.getState().timer).toEqual(INITIAL_TIMER_STATE);
  });

  it('re-creates the default categories and today\'s quests right away', async () => {
    await fillEveryStore();
    await resetAllData();

    const categories = useCategoryStore.getState().categories;
    expect(categories).toHaveLength(5);
    expect(categories.some((c) => c.name === 'Mine')).toBe(false);
    expect(useCategoryStore.getState().isInitialized).toBe(true);
    expect(useDailyQuestsStore.getState().quests.length).toBeGreaterThan(0);
    expect(useWeeklyGoalsStore.getState().goals.length).toBeGreaterThan(0);
  });

  it('erases the data on disk, including backups', async () => {
    await fillEveryStore();
    await resetAllData();

    const storage = disk();
    expect(storage[backupKey('todo-storage')]).toBeUndefined();
    const everything = JSON.stringify(storage);
    expect(everything).not.toContain('Secret plan');
    expect(everything).not.toContain('"Mine"');
    expect(everything).not.toContain('user-1');
  });

  it('cancels scheduled notifications and dismisses shown ones', async () => {
    await resetAllData();
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalled();
  });

  it('applies the default (system) language again', async () => {
    useSettingsStore.getState().updateSettings({ language: 'tr' });
    await resetAllData();
    expect(changeLanguage).toHaveBeenCalledWith('system');
  });

  it('keepSignedIn keeps the account and lets its new changes queue', async () => {
    await fillEveryStore();

    await resetAllData({ keepSignedIn: true });

    expect(authService.signOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(useAuthStore.getState().lastUserId).toBe('user-1');
    expect(useSyncStore.getState().ownerId).toBe('user-1');
    expect(useTodoStore.getState().todos).toEqual([]);
  });

  it('still erases the data when notifications cannot be cleared', async () => {
    (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mockRejectedValueOnce(new Error('denied'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    useSettingsStore.getState().completeOnboarding();

    await resetAllData();

    expect(useSettingsStore.getState().settings.hasCompletedOnboarding).toBe(false);
  });
});
