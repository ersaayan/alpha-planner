import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, PomodoroSettings } from '@/types';
import { DEFAULT_APP_SETTINGS, DEFAULT_POMODORO_SETTINGS } from '@/types';
import { asRecord, createPersistOptions } from './persist';

interface SettingsState {
  settings: AppSettings;
  pomodoroSettings: PomodoroSettings;

  // Actions
  updateSettings: (settings: Partial<AppSettings>) => void;
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) => void;
  completeOnboarding: () => void;
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
      version: 2,
      partialize: (state) => ({ settings: state.settings, pomodoroSettings: state.pomodoroSettings }),
      migrate: migrateSettingsState,
    })
  )
);

/**
 * v0 (unversioned) and v1 share a shape; the deep merge fills in any missing setting.
 * v1 → v2: Monday was the default for everyone; it becomes 'auto' (Monday in Turkish,
 * Sunday in English). An explicit Sunday is kept.
 */
export function migrateSettingsState(persisted: unknown, fromVersion: number) {
  const state = asRecord(persisted);
  const settings = asRecord(state.settings);
  if (fromVersion < 2 && settings.weekStartsOn === 1) settings.weekStartsOn = 'auto';
  return {
    settings,
    pomodoroSettings: asRecord(state.pomodoroSettings),
  };
}
