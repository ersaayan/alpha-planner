import { useSyncExternalStore } from 'react';
import { useAuthStore } from './auth-store';
import { useCategoryStore } from './category-store';
import { useDailyQuestsStore } from './daily-quests-store';
import { useGamificationStore } from './gamification-store';
import { isHydrationFailed, onHydrationFailure } from './persist';
import { usePomodoroStore } from './pomodoro-store';
import { useSettingsStore } from './settings-store';
import { useSyncStore } from './sync-store';
import { useTodoStore } from './todo-store';
import { useWeeklyGoalsStore } from './weekly-goals-store';

/** The bits of a Zustand persist store this module needs. */
export interface PersistedStore {
  persist: {
    hasHydrated(): boolean;
    onFinishHydration(listener: () => void): () => void;
    getOptions(): { name?: string };
  };
}

/** Every persisted store in the app. */
export const PERSISTED_STORES: readonly PersistedStore[] = [
  useSettingsStore,
  useTodoStore,
  useCategoryStore,
  useGamificationStore,
  usePomodoroStore,
  useDailyQuestsStore,
  useWeeklyGoalsStore,
  useSyncStore,
  useAuthStore,
];

/**
 * A store counts as settled once it has hydrated, or once loading its data failed
 * (it then runs on defaults without overwriting the stored copy, see stores/persist.ts).
 */
function isSettled(store: PersistedStore): boolean {
  if (store.persist.hasHydrated()) return true;
  const name = store.persist.getOptions().name;
  return name !== undefined && isHydrationFailed(name);
}

export function areStoresHydrated(stores: readonly PersistedStore[] = PERSISTED_STORES): boolean {
  return stores.every(isSettled);
}

function subscribe(stores: readonly PersistedStore[], listener: () => void): () => void {
  const unsubscribers = stores.map((store) => store.persist.onFinishHydration(() => listener()));
  unsubscribers.push(onHydrationFailure(listener));
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

const subscribeAll = (listener: () => void) => subscribe(PERSISTED_STORES, listener);
const getAllHydrated = () => areStoresHydrated(PERSISTED_STORES);

/** True once every persisted store has loaded its data from disk. */
export function useStoresHydrated(): boolean {
  return useSyncExternalStore(subscribeAll, getAllHydrated, getAllHydrated);
}

/**
 * Resolves once the given stores (default: all) have loaded their data. Safe to call
 * at any time, including after hydration has already finished.
 */
export function whenStoresHydrated(stores: readonly PersistedStore[] = PERSISTED_STORES): Promise<void> {
  return new Promise((resolve) => {
    if (areStoresHydrated(stores)) {
      resolve();
      return;
    }
    const unsubscribe = subscribe(stores, () => {
      if (areStoresHydrated(stores)) {
        unsubscribe();
        resolve();
      }
    });
  });
}
