/**
 * Keeps the task due-time reminders in step with the todos: after the stores have loaded,
 * whenever todos or the notifications setting change, on resume (the permission may have
 * changed in system settings) and when the language changes (channel name, text).
 * Mounted once, in the root layout.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';

import i18n from '@/services/i18n/i18n-config';
import { requestNotificationPermission } from '@/services/notifications/alert-permissions';
import { ensureTaskReminderChannel, syncTaskReminders } from '@/services/notifications/task-reminders';
import { whenStoresHydrated } from '@/stores/hydration';
import { useSettingsStore } from '@/stores/settings-store';
import { useTodoStore } from '@/stores/todo-store';

/** Debounce for bursts of todo changes (e.g. typing a title, a bulk import). */
const SYNC_DELAY_MS = 300;

export function syncTaskRemindersFromStores(): Promise<void> {
  return syncTaskReminders({
    todos: useTodoStore.getState().todos,
    notificationsEnabled: useSettingsStore.getState().settings.notificationsEnabled,
  });
}

/**
 * Asks for notification permission (only prompts if never answered) when the user gives a
 * task a due time, then schedules its reminder.
 */
export async function enableTaskReminders(): Promise<void> {
  if (!useSettingsStore.getState().settings.notificationsEnabled) return;
  try {
    await requestNotificationPermission();
  } catch {
    // The reminder is simply not scheduled without permission.
  }
  await syncTaskRemindersFromStores();
}

export function useTaskReminders(): void {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribers: (() => void)[] = [];

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (!cancelled) void syncTaskRemindersFromStores();
      }, SYNC_DELAY_MS);
    };

    void whenStoresHydrated([useTodoStore, useSettingsStore]).then(() => {
      if (cancelled) return;
      void syncTaskRemindersFromStores();
      unsubscribers.push(
        useTodoStore.subscribe((state, previous) => {
          if (state.todos !== previous.todos) schedule();
        }),
        useSettingsStore.subscribe((state, previous) => {
          if (state.settings.notificationsEnabled !== previous.settings.notificationsEnabled) schedule();
        })
      );
    });

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') schedule();
    });

    const onLanguageChanged = () => {
      void ensureTaskReminderChannel().catch(() => undefined);
      schedule();
    };
    const languageEvents = i18n as unknown as {
      on?: (event: string, listener: () => void) => void;
      off?: (event: string, listener: () => void) => void;
    };
    languageEvents.on?.('languageChanged', onLanguageChanged);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      appState.remove();
      languageEvents.off?.('languageChanged', onLanguageChanged);
    };
  }, []);
}
