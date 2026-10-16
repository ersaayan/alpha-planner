import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { runDateDependentTasks, runStartupTasks } from '@/services/app/startup-tasks';
import { changeLanguage } from '@/services/i18n/i18n-config';
import * as authService from '@/services/supabase/auth-service';
import { isSyncConfigured } from '@/services/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useCategoryStore } from '@/stores/category-store';
import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { useGamificationStore } from '@/stores/gamification-store';
import { whenStoresHydrated } from '@/stores/hydration';
import { useSettingsStore } from '@/stores/settings-store';
import { useSyncStore } from '@/stores/sync-store';
import { useTodoStore } from '@/stores/todo-store';
import { useWeeklyGoalsStore } from '@/stores/weekly-goals-store';
import { getDateKey } from '@/utils/date';

/** Show the app anyway if loading stored data takes longer than this. */
export const HYDRATION_TIMEOUT_MS = 5000;

/** How often to check, while the app is open, whether the local date has changed. */
const DATE_CHECK_INTERVAL_MS = 60_000;

/**
 * Stores the startup tasks read or write. Pomodoro is left out on purpose: the tasks
 * never touch it, and a failed pomodoro load must not block quests and categories.
 */
const STARTUP_STORES = [
  useSettingsStore,
  useTodoStore,
  useCategoryStore,
  useGamificationStore,
  useDailyQuestsStore,
  useWeeklyGoalsStore,
];

/**
 * App start-up, in order:
 * 1. wait until the stores have loaded their data (the splash stays up meanwhile,
 *    with a timeout fallback),
 * 2. then create first-launch defaults and today's quests/goals and apply the saved
 *    language, never before (they would overwrite stored data),
 * 3. keep the date-dependent tasks current when the app resumes or the day changes.
 *
 * Returns true once the UI may render.
 */
export function useAppBootstrap(): boolean {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      console.warn(`[startup] Stored data did not load within ${HYDRATION_TIMEOUT_MS} ms; showing the app anyway.`);
      setIsTimedOut(true);
    }, HYDRATION_TIMEOUT_MS);

    whenStoresHydrated(STARTUP_STORES)
      .then(() => {
        if (cancelled) return;
        runStartupTasks();
        changeLanguage(useSettingsStore.getState().settings.language);
        // Everything else (e.g. the timer) should be loaded too before the UI shows.
        return whenStoresHydrated();
      })
      .then(() => {
        if (cancelled) return;
        clearTimeout(timeout);
        setIsInitialized(true);
      })
      .catch((error) => {
        console.warn('[startup] Initialization failed', error);
        if (!cancelled) setIsTimedOut(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  useDayChangeTasks(isInitialized);
  useLanguageSync(isInitialized);
  useAuthLifecycle();

  return isInitialized || isTimedOut;
}

/**
 * Re-runs the date-dependent tasks when the app returns to the foreground and when
 * the local date changes while it is open (e.g. past midnight, or into Monday).
 */
function useDayChangeTasks(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let lastDateKey = getDateKey();
    let interval: ReturnType<typeof setInterval> | null = null;

    const checkDate = () => {
      const dateKey = getDateKey();
      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        runDateDependentTasks();
      }
    };
    const startChecking = () => {
      if (interval === null) interval = setInterval(checkDate, DATE_CHECK_INTERVAL_MS);
    };
    const stopChecking = () => {
      if (interval !== null) clearInterval(interval);
      interval = null;
    };

    if (AppState.currentState === 'active') startChecking();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        lastDateKey = getDateKey();
        // Idempotent: each task does nothing when today's/this week's data exists.
        runDateDependentTasks();
        startChecking();
      } else {
        stopChecking();
      }
    });

    return () => {
      subscription.remove();
      stopChecking();
    };
  }, [enabled]);
}

/** Applies the saved language whenever it changes, and the device language on resume for "system". */
function useLanguageSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = useSettingsStore.subscribe((state, previous) => {
      if (state.settings.language !== previous.settings.language) {
        changeLanguage(state.settings.language);
      }
    });
    const subscription = AppState.addEventListener('change', (state) => {
      const { language } = useSettingsStore.getState().settings;
      if (state === 'active' && language === 'system') changeLanguage('system');
    });
    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, [enabled]);
}

/**
 * Builds with sync only: mirrors Supabase auth events into the auth store and runs
 * token auto-refresh only while the app is in the foreground.
 */
function useAuthLifecycle() {
  useEffect(() => {
    if (!isSyncConfigured) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    // The sync owner must not be set before the sync store has loaded its own copy.
    whenStoresHydrated([useAuthStore, useSyncStore]).then(() => {
      if (cancelled) return;
      unsubscribe = authService.onAuthStateChange((_event, session) => {
        useAuthStore.getState().handleSession(session);
      });
    });

    authService.setAutoRefresh(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      authService.setAutoRefresh(state === 'active');
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
      subscription.remove();
      authService.setAutoRefresh(false);
    };
  }, []);
}
