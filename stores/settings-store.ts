import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings, PomodoroSettings } from '@/types';
import { DEFAULT_APP_SETTINGS, DEFAULT_POMODORO_SETTINGS } from '@/types';

interface SettingsState {
  settings: AppSettings;
  pomodoroSettings: PomodoroSettings;

  // Actions
  updateSettings: (settings: Partial<AppSettings>) => void;
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) => void;
  completeOnboarding: () => void;
  resetSettings: () => void;
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

      updatePomodoroSettings: (newSettings) =>
        set((state) => ({
          pomodoroSettings: { ...state.pomodoroSettings, ...newSettings },
        })),

      completeOnboarding: () =>
        set((state) => ({
          settings: { ...state.settings, hasCompletedOnboarding: true },
        })),

      resetSettings: () =>
        set({
          settings: DEFAULT_APP_SETTINGS,
          pomodoroSettings: DEFAULT_POMODORO_SETTINGS,
        }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
