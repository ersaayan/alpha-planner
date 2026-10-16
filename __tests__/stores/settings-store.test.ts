import { migrateSettingsState, useSettingsStore } from '@/stores/settings-store';
import { DEFAULT_APP_SETTINGS, DEFAULT_POMODORO_SETTINGS } from '@/types';

const INITIAL_STATE = {
  settings: { ...DEFAULT_APP_SETTINGS },
  pomodoroSettings: { ...DEFAULT_POMODORO_SETTINGS },
};

beforeEach(() => {
  useSettingsStore.setState(INITIAL_STATE);
});

describe('useSettingsStore', () => {
  // ── initial state ─────────────────────────────────────────────────────

  it('initial state has default settings', () => {
    const state = useSettingsStore.getState();
    expect(state.settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(state.pomodoroSettings).toEqual(DEFAULT_POMODORO_SETTINGS);
  });

  // ── updateSettings ────────────────────────────────────────────────────

  it('updateSettings: merges partial settings', () => {
    useSettingsStore.getState().updateSettings({ soundEnabled: false });

    const state = useSettingsStore.getState();
    expect(state.settings.soundEnabled).toBe(false);
    // Other settings remain unchanged
    expect(state.settings.hapticFeedbackEnabled).toBe(true);
    expect(state.settings.notificationsEnabled).toBe(true);
  });

  it('theme setting: accepts light, dark, system', () => {
    for (const theme of ['light', 'dark', 'system'] as const) {
      useSettingsStore.getState().updateSettings({ theme });
      expect(useSettingsStore.getState().settings.theme).toBe(theme);
    }
  });

  it('language setting: accepts tr, en, system', () => {
    for (const language of ['tr', 'en', 'system'] as const) {
      useSettingsStore.getState().updateSettings({ language });
      expect(useSettingsStore.getState().settings.language).toBe(language);
    }
  });

  // ── updatePomodoroSettings ────────────────────────────────────────────

  it('updatePomodoroSettings: updates pomodoro settings', () => {
    useSettingsStore.getState().updatePomodoroSettings({ focusDuration: 30 * 60 });

    const state = useSettingsStore.getState();
    expect(state.pomodoroSettings.focusDuration).toBe(30 * 60);
    // Other pomodoro settings remain unchanged
    expect(state.pomodoroSettings.shortBreakDuration).toBe(DEFAULT_POMODORO_SETTINGS.shortBreakDuration);
  });

  it('updatePomodoroSettings: rejects zero focusDuration', () => {
    const before = useSettingsStore.getState().pomodoroSettings.focusDuration;
    useSettingsStore.getState().updatePomodoroSettings({ focusDuration: 0 });
    expect(useSettingsStore.getState().pomodoroSettings.focusDuration).toBe(before);
  });

  it('updatePomodoroSettings: rejects negative shortBreakDuration', () => {
    const before = useSettingsStore.getState().pomodoroSettings.shortBreakDuration;
    useSettingsStore.getState().updatePomodoroSettings({ shortBreakDuration: -5 });
    expect(useSettingsStore.getState().pomodoroSettings.shortBreakDuration).toBe(before);
  });

  it('updatePomodoroSettings: rejects zero longBreakDuration', () => {
    const before = useSettingsStore.getState().pomodoroSettings.longBreakDuration;
    useSettingsStore.getState().updatePomodoroSettings({ longBreakDuration: 0 });
    expect(useSettingsStore.getState().pomodoroSettings.longBreakDuration).toBe(before);
  });

  it('updatePomodoroSettings: rejects zero sessionsUntilLongBreak', () => {
    const before = useSettingsStore.getState().pomodoroSettings.sessionsUntilLongBreak;
    useSettingsStore.getState().updatePomodoroSettings({ sessionsUntilLongBreak: 0 });
    expect(useSettingsStore.getState().pomodoroSettings.sessionsUntilLongBreak).toBe(before);
  });

  // ── completeOnboarding ────────────────────────────────────────────────

  it('completeOnboarding: sets hasCompletedOnboarding to true', () => {
    expect(useSettingsStore.getState().settings.hasCompletedOnboarding).toBe(false);
    useSettingsStore.getState().completeOnboarding();
    expect(useSettingsStore.getState().settings.hasCompletedOnboarding).toBe(true);
  });

  // ── resetSettings ─────────────────────────────────────────────────────

  it('resetSettings: restores default settings', () => {
    useSettingsStore.getState().updateSettings({ theme: 'dark', soundEnabled: false });
    useSettingsStore.getState().updatePomodoroSettings({ focusDuration: 45 * 60 });
    useSettingsStore.getState().completeOnboarding();

    useSettingsStore.getState().resetSettings();

    const state = useSettingsStore.getState();
    expect(state.settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(state.pomodoroSettings).toEqual(DEFAULT_POMODORO_SETTINGS);
  });

  // resetAllData is covered in __tests__/stores/reset-all-data.test.ts
});

describe('migrateSettingsState', () => {
  it('keeps stored settings objects for the deep merge', () => {
    const migrated = migrateSettingsState({ settings: { theme: 'dark' }, pomodoroSettings: { focusDuration: 1800 } }, 0);
    expect(migrated).toEqual({ settings: { theme: 'dark' }, pomodoroSettings: { focusDuration: 1800 } });
  });

  it('tolerates garbage', () => {
    expect(migrateSettingsState(null, 0)).toEqual({ settings: {}, pomodoroSettings: {} });
    expect(migrateSettingsState({ settings: 'x', pomodoroSettings: [1] }, 0)).toEqual({ settings: {}, pomodoroSettings: {} });
  });
});
