import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings, PomodoroSettings } from '@/types';
import { DEFAULT_APP_SETTINGS, DEFAULT_POMODORO_SETTINGS, INITIAL_TIMER_STATE, INITIAL_USER_STATS } from '@/types';

interface SettingsState {
  settings: AppSettings;
  pomodoroSettings: PomodoroSettings;
  _hasHydrated: boolean;

  // Actions
  updateSettings: (settings: Partial<AppSettings>) => void;
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) => void;
  completeOnboarding: () => void;
  resetSettings: () => void;
  resetAllData: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_APP_SETTINGS,
      pomodoroSettings: DEFAULT_POMODORO_SETTINGS,
      _hasHydrated: false,

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
        // Clear all persisted stores
        await AsyncStorage.multiRemove([
          'settings-storage',
          'pomodoro-storage',
          'todo-storage',
          'category-storage',
          'gamification-storage',
        ]);

        // Reset this store's state
        set({
          settings: DEFAULT_APP_SETTINGS,
          pomodoroSettings: DEFAULT_POMODORO_SETTINGS,
        });

        // Reset other stores via their zustand APIs
        const { usePomodoroStore } = require('./pomodoro-store');
        const { useTodoStore } = require('./todo-store');
        const { useCategoryStore } = require('./category-store');
        const { useGamificationStore } = require('./gamification-store');

        usePomodoroStore.setState({
          timer: INITIAL_TIMER_STATE,
          sessions: [],
          currentSession: null,
        });
        useTodoStore.setState({ todos: [], filter: {} });
        useCategoryStore.setState({ categories: [], isInitialized: false });
        useGamificationStore.setState({
          stats: INITIAL_USER_STATS,
          unlockedAchievements: [],
          dailyStats: [],
          pendingNotifications: [],
        });
      },
    }),
    {
      name: 'settings-storage',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ _hasHydrated: true });
      },
      partialize: (state) => {
        const { _hasHydrated, ...rest } = state;
        return rest;
      },
      migrate: (persistedState: unknown, version: number) => {
        return persistedState as SettingsState;
      },
    }
  )
);
