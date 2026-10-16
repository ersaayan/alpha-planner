import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { runStartupTasks } from '@/services/app/startup-tasks';
import { changeLanguage } from '@/services/i18n/i18n-config';
import { INITIAL_PRESTIGE_STATE, INITIAL_TIMER_STATE } from '@/types';
import { useAuthStore } from './auth-store';
import { useCategoryStore } from './category-store';
import { useDailyQuestsStore } from './daily-quests-store';
import { useGamificationStore } from './gamification-store';
import { backupKey, markStoreWritable } from './persist';
import { usePomodoroStore } from './pomodoro-store';
import { useSettingsStore } from './settings-store';
import { useSyncStore } from './sync-store';
import { useTodoStore } from './todo-store';
import { useWeeklyGoalsStore } from './weekly-goals-store';

export interface ResetAllDataOptions {
  /**
   * Keep the signed-in sync account (used when a different account signs in and the
   * user chooses to start fresh). By default the device is signed out as well.
   */
  keepSignedIn?: boolean;
}

/** Stores that use stores/persist.ts; reset to their initial state. */
const RESETTABLE_STORES = [
  useSettingsStore,
  useTodoStore,
  useCategoryStore,
  useGamificationStore,
  useDailyQuestsStore,
  useWeeklyGoalsStore,
  useSyncStore,
  useAuthStore,
] as const;

function storageName(store: { persist: { getOptions: () => { name?: string } } }): string | undefined {
  return store.persist.getOptions().name;
}

/**
 * "Reset all data": erases everything the app stores on this device and returns
 * every store to its first-launch state. PRIVACY.md promises exactly this.
 */
export async function resetAllData(options: ResetAllDataOptions = {}): Promise<void> {
  // Stop any running timer first to prevent a ghost interval
  try {
    const pomodoroState = usePomodoroStore.getState();
    if (pomodoroState.timer.state === 'running' || pomodoroState.timer.state === 'paused') {
      pomodoroState.stopTimer();
    }
  } catch {
    // Timer stop is best-effort
  }

  // Scheduled and shown notifications (timer, daily summary) must not outlive the data.
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.warn('[reset] Could not clear notifications', error);
  }

  if (!options.keepSignedIn) {
    // Never throws; also drops the sync queue.
    await useAuthStore.getState().signOut();
  }
  const { status, user } = useAuthStore.getState();

  // Remove the stored copies, including backups of unreadable data.
  const names = [...RESETTABLE_STORES, usePomodoroStore]
    .map(storageName)
    .filter((name): name is string => typeof name === 'string');
  await AsyncStorage.multiRemove([...names, ...names.map(backupKey)]);

  for (const store of RESETTABLE_STORES) {
    const name = storageName(store);
    if (name) markStoreWritable(name);
  }

  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useTodoStore.setState(useTodoStore.getInitialState(), true);
  useCategoryStore.setState(useCategoryStore.getInitialState(), true);
  useGamificationStore.setState(
    {
      ...useGamificationStore.getInitialState(),
      // A fresh store starts in the current season, so no prestige reset fires right away.
      prestige: { ...INITIAL_PRESTIGE_STATE, currentSeasonStart: new Date().toISOString().slice(0, 7) },
    },
    true
  );
  useDailyQuestsStore.setState(useDailyQuestsStore.getInitialState(), true);
  useWeeklyGoalsStore.setState(useWeeklyGoalsStore.getInitialState(), true);
  useSyncStore.setState(useSyncStore.getInitialState(), true);
  useAuthStore.setState(
    {
      ...useAuthStore.getInitialState(),
      status,
      user,
      lastUserId: options.keepSignedIn ? (user?.id ?? null) : null,
    },
    true
  );
  if (options.keepSignedIn && user) {
    useSyncStore.getState().setOwner(user.id);
  }
  usePomodoroStore.setState({
    timer: INITIAL_TIMER_STATE,
    sessions: [],
    currentSession: null,
  });

  // Back to first-launch state: default categories, today's quests, this week's goals.
  runStartupTasks();
  changeLanguage(useSettingsStore.getState().settings.language);
}
