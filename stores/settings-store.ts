import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, DashboardCardId, PomodoroSettings } from '@/types';
import { DASHBOARD_CARD_IDS, DEFAULT_APP_SETTINGS, DEFAULT_POMODORO_SETTINGS } from '@/types';
import { asRecord, createPersistOptions } from './persist';

interface SettingsState {
  settings: AppSettings;
  pomodoroSettings: PomodoroSettings;

  // Actions
  updateSettings: (settings: Partial<AppSettings>) => void;
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) => void;
  completeOnboarding: () => void;
  /** Folds or unfolds a Dashboard card. */
  toggleDashboardCard: (card: DashboardCardId) => void;
  resetSettings: () => void;
  /** Erases everything stored on this device. See stores/reset-all-data.ts. */
  resetAllData: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_APP_SETTINGS,
      pomodoroSettings: DEFAULT_POMODORO_SETTINGS,

      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      updatePomodoroSettings: (newSettings) => {
        // Validate duration values
        if (newSettings.focusDuration !== undefined && newSettings.focusDuration <= 0) return;
        if (newSettings.shortBreakDuration !== undefined && newSettings.shortBreakDuration <= 0) return;
        if (newSettings.longBreakDuration !== undefined && newSettings.longBreakDuration <= 0) return;
        if (newSettings.sessionsUntilLongBreak !== undefined && newSettings.sessionsUntilLongBreak <= 0) return;

        set((state) => ({
          pomodoroSettings: { ...state.pomodoroSettings, ...newSettings },
        }));
      },

      completeOnboarding: () =>
        set((state) => ({
          settings: { ...state.settings, hasCompletedOnboarding: true },
        })),

      toggleDashboardCard: (card) =>
        set((state) => {
          const collapsed = state.settings.collapsedDashboardCards;
          return {
            settings: {
              ...state.settings,
              collapsedDashboardCards: collapsed.includes(card)
                ? collapsed.filter((id) => id !== card)
                : [...collapsed, card],
            },
          };
        }),

      resetSettings: () =>
        set({
          settings: DEFAULT_APP_SETTINGS,
          pomodoroSettings: DEFAULT_POMODORO_SETTINGS,
        }),

      resetAllData: async () => {
        // Loaded lazily: reset-all-data imports every store, including pomodoro-store,
        // which itself imports this store.
        const { resetAllData } = require('./reset-all-data') as typeof import('./reset-all-data');
        await resetAllData();
      },
    }),
    createPersistOptions<SettingsState, Pick<SettingsState, 'settings' | 'pomodoroSettings'>>({
      name: 'settings-storage',
      // v2: weekStartsOn can be 'auto' (the new default).
      // v3: collapsedDashboardCards (folded Dashboard cards).
      version: 3,
      partialize: (state) => ({ settings: state.settings, pomodoroSettings: state.pomodoroSettings }),
      migrate: migrateSettingsState,
      restore: restoreWeekStart,
    })
  )
);

/**
 * v0 (unversioned) and v1 share a shape; the deep merge fills in any missing setting.
 * v1 → v2: Monday was the default for everyone; it becomes 'auto' (Monday in Turkish,
 * Sunday in English). An explicit Sunday is kept.
 * v2 → v3: collapsedDashboardCards is new; older data gets the default (season folded)
 * from the deep merge. A stored value is kept only if it is a list of known cards.
 */
export function migrateSettingsState(persisted: unknown, fromVersion: number) {
  const state = asRecord(persisted);
  const settings = asRecord(state.settings);
  if (fromVersion < 2 && settings.weekStartsOn === 1) settings.weekStartsOn = 'auto';
  if ('collapsedDashboardCards' in settings) {
    const cards = settings.collapsedDashboardCards;
    if (Array.isArray(cards)) {
      settings.collapsedDashboardCards = cards.filter((id): id is DashboardCardId =>
        DASHBOARD_CARD_IDS.includes(id as DashboardCardId)
      );
    } else {
      delete settings.collapsedDashboardCards;
    }
  }
  return {
    settings,
    pomodoroSettings: asRecord(state.pomodoroSettings),
  };
}

/**
 * weekStartsOn is 0 | 1 | 'auto'. Its default is the string 'auto', so the deep merge
 * treats a stored 0 or 1 as the wrong kind of value and drops it; put the user's
 * explicit choice back.
 */
export function restoreWeekStart<S extends { settings: AppSettings }>(merged: S, persisted: unknown): S {
  const stored = asRecord(asRecord(persisted).settings).weekStartsOn;
  if (stored !== 0 && stored !== 1) return merged;
  return { ...merged, settings: { ...merged.settings, weekStartsOn: stored } };
}
