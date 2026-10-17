/**
 * Keeps the Pomodoro timer and its alerts in step with the app lifecycle. Mounted once,
 * in the root layout.
 *
 * - Catch-up waits until every store the timer credits has hydrated (cold start).
 * - Returning to the foreground catches up again. AppState changes never cancel or
 *   reschedule alerts: the OS owns them, so they also fire after the app is killed.
 * - Taps and action buttons on timer notifications are handled here, including the
 *   response that launched the app.
 * - Alerts are re-armed when notification settings, permissions or the language change.
 */
import * as Notifications from 'expo-notifications';
import { router, useNavigationContainerRef, type Href } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import i18n from '@/services/i18n/i18n-config';
import { notificationService } from '@/services/notifications';
import { requestNotificationPermission } from '@/services/notifications/alert-permissions';
import { routeForAppNotification } from '@/services/notifications/app-notification-routes';
import { POMODORO_ACTIONS, POMODORO_ROUTE, initializeAlerts } from '@/services/notifications/pomodoro-alerts';
import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { useGamificationStore } from '@/stores/gamification-store';
import { usePomodoroStore } from '@/stores/pomodoro-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useTodoStore } from '@/stores/todo-store';
import { useWeeklyGoalsStore } from '@/stores/weekly-goals-store';

interface PersistedStore {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (listener: () => void) => () => void;
  };
}

/** Stores read or credited when the timer completes a phase. */
const timerStores = (): PersistedStore[] => [
  usePomodoroStore,
  useSettingsStore,
  useGamificationStore,
  useTodoStore,
  useDailyQuestsStore,
  useWeeklyGoalsStore,
];

/**
 * Calls `callback` once all timer-related stores have hydrated from AsyncStorage, so a
 * catch-up credit is never overwritten by a store that loads later.
 */
export function whenTimerStoresHydrated(
  callback: () => void,
  stores: PersistedStore[] = timerStores(),
): () => void {
  const waiting = new Set(stores.filter((store) => !store.persist.hasHydrated()));
  if (waiting.size === 0) {
    callback();
    return () => undefined;
  }
  let fired = false;
  const unsubscribes = [...waiting].map((store) =>
    store.persist.onFinishHydration(() => {
      waiting.delete(store);
      if (waiting.size === 0 && !fired) {
        fired = true;
        callback();
      }
    }),
  );
  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
}

const handledResponses = new Set<string>();

function responseKey(response: Notifications.NotificationResponse): string {
  return [
    response.notification.request.identifier,
    response.actionIdentifier,
    response.notification.date,
  ].join('|');
}

/**
 * Applies a notification action to the timer. The timer is synced first, so an action
 * from a stale notification never acts on a phase that has already ended.
 * Returns the route to open, if any.
 */
export function handleTimerResponse(response: Notifications.NotificationResponse): string | null {
  const key = responseKey(response);
  if (handledResponses.has(key)) return null;
  handledResponses.add(key);

  const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
  const store = usePomodoroStore.getState();
  store.syncTimer({ source: 'action' });

  switch (response.actionIdentifier) {
    case POMODORO_ACTIONS.pause:
      store.pauseTimer();
      break;
    case POMODORO_ACTIONS.resume:
      store.resumeTimer();
      break;
    case POMODORO_ACTIONS.stop:
      store.stopTimer();
      break;
    case POMODORO_ACTIONS.skip:
      // Only skip the phase the notification was about.
      if (usePomodoroStore.getState().timer.startedAt === data.phaseStartedAt) {
        store.skipToNextPhase();
      }
      break;
    default:
      break;
  }
  return data.url === POMODORO_ROUTE ? POMODORO_ROUTE : null;
}

export function usePomodoroLifecycle(): void {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    let hydrated = false;
    let pendingRoute: string | null = null;
    let exactAlarmsGranted: boolean | null = null;
    const queuedResponses: Notifications.NotificationResponse[] = [];

    const flushRoute = () => {
      if (!pendingRoute || !navigationRef.isReady()) return;
      const route = pendingRoute;
      pendingRoute = null;
      // After the current navigation settles (e.g. the index redirect on launch).
      setTimeout(() => {
        try {
          router.navigate(route as Href);
        } catch (error) {
          console.warn('[Pomodoro] Could not open the timer screen:', error);
        }
      }, 0);
    };

    const handleResponse = (response: Notifications.NotificationResponse) => {
      // Timer alerts first; daily-summary and task-reminder taps have their own routes.
      const route = handleTimerResponse(response) ?? routeForAppNotification(response);
      if (route && useSettingsStore.getState().settings.hasCompletedOnboarding) {
        pendingRoute = route;
        flushRoute();
      }
    };

    const checkExactAlarms = async () => {
      if (Platform.OS !== 'android') return;
      try {
        const granted = (await Notifications.getExactAlarmPermissionsAsync()).granted;
        // Alarms scheduled while the permission was missing are inexact; reschedule them.
        if (exactAlarmsGranted === false && granted) usePomodoroStore.getState().refreshAlerts();
        exactAlarmsGranted = granted;
      } catch {
        // Older native module: nothing to do.
      }
    };

    notificationService.initialize().catch((error) => {
      console.warn('[Pomodoro] Notification setup failed:', error);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (hydrated) handleResponse(response);
      else queuedResponses.push(response);
    });

    const stopWaiting = whenTimerStoresHydrated(() => {
      hydrated = true;
      const store = usePomodoroStore.getState();
      store.syncTimer({ source: 'launch' });
      store.refreshAlerts();

      try {
        const launchResponse = Notifications.getLastNotificationResponse();
        if (launchResponse) queuedResponses.unshift(launchResponse);
      } catch {
        // Not available on this platform.
      }
      queuedResponses.splice(0).forEach(handleResponse);
      try {
        Notifications.clearLastNotificationResponse();
      } catch {
        // Not available on this platform.
      }

      void notificationService
        .syncDailySummary(useSettingsStore.getState().settings.notificationsEnabled)
        .catch(() => undefined);
      void checkExactAlarms();
    });

    const appStateSubscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || !hydrated) return;
      usePomodoroStore.getState().syncTimer({ source: 'foreground' });
      void checkExactAlarms();
    });

    const unsubscribeSettings = useSettingsStore.subscribe((state, previous) => {
      if (!hydrated) return;
      const now = state.settings;
      const before = previous.settings;
      const enabledChanged = now.notificationsEnabled !== before.notificationsEnabled;
      if (
        enabledChanged ||
        now.soundEnabled !== before.soundEnabled ||
        now.timeFormat !== before.timeFormat ||
        state.pomodoroSettings !== previous.pomodoroSettings
      ) {
        usePomodoroStore.getState().refreshAlerts();
      }
      if (enabledChanged) {
        void notificationService.syncDailySummary(now.notificationsEnabled).catch(() => undefined);
        if (now.notificationsEnabled) {
          void requestNotificationPermission()
            .then(() => usePomodoroStore.getState().refreshAlerts())
            .catch(() => undefined);
        }
      }
    });

    const onLanguageChanged = () => {
      void initializeAlerts()
        .then(() => usePomodoroStore.getState().refreshAlerts())
        .catch(() => undefined);
    };
    const languageEvents = i18n as unknown as {
      on?: (event: string, listener: () => void) => void;
      off?: (event: string, listener: () => void) => void;
    };
    languageEvents.on?.('languageChanged', onLanguageChanged);

    const unsubscribeNavigation = navigationRef.addListener?.('state', flushRoute);

    return () => {
      stopWaiting();
      responseSubscription.remove();
      appStateSubscription.remove();
      unsubscribeSettings();
      languageEvents.off?.('languageChanged', onLanguageChanged);
      unsubscribeNavigation?.();
    };
  }, [navigationRef]);
}
