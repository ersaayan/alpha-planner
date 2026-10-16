/**
 * End-of-phase alerts for the Pomodoro timer.
 *
 * The operating system delivers every alert: when a phase starts, the whole chain of
 * phase ends up to the next manual start is scheduled as DATE notifications with fixed
 * identifiers (one per chain position). JS never has to be alive for an alert to fire,
 * so it works with the screen off and after the app is swiped away.
 *
 * `armAlerts` is the only writer. It is serialized and idempotent: every call describes
 * the complete desired state, and calls that arrive while one is running are coalesced.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/services/i18n/i18n-config';
import type { PomodoroPhase, PomodoroSettings, PomodoroTimerState } from '@/types';
import {
  ALERT_CHAIN_LIMIT,
  formatClock,
  getPhaseDuration,
  getPhaseEndMs,
  getRemainingSeconds,
  planAlerts,
  toActivePhase,
  type PlannedAlert,
} from '@/utils/pomodoro-helpers';

/** Route opened when a timer notification is tapped. */
export const POMODORO_ROUTE = '/pomodoro';

export const PHASE_END_ID_PREFIX = 'pomodoro-phase-end-';

/** Fixed identifier of the alert for the phase at `chainIndex` in the auto-start chain. */
export function phaseEndId(chainIndex: number): string {
  const index = Math.min(Math.max(0, Math.floor(chainIndex)), ALERT_CHAIN_LIMIT - 1);
  return `${PHASE_END_ID_PREFIX}${index}`;
}

export const PHASE_END_IDS: readonly string[] = Array.from({ length: ALERT_CHAIN_LIMIT }, (_, i) =>
  phaseEndId(i),
);

const TEST_ALERT_ID = 'pomodoro-test-alert';

/** `content.data.kind` of the notifications this module posts. */
export const NOTIFICATION_KIND = {
  phaseEnd: 'pomodoro-phase-end',
  ongoing: 'pomodoro-ongoing',
  test: 'pomodoro-test',
} as const;

/** Action button identifiers on the ongoing notification (Android). */
export const POMODORO_ACTIONS = {
  pause: 'pomodoro-pause',
  resume: 'pomodoro-resume',
  skip: 'pomodoro-skip',
  stop: 'pomodoro-stop',
} as const;

export const POMODORO_CATEGORIES = {
  running: 'pomodoro-running',
  paused: 'pomodoro-paused',
} as const;

/**
 * Android channels. A channel's sound and vibration cannot change after it is created,
 * so ids carry a version: change the id (and list the old one in OBSOLETE_CHANNEL_IDS)
 * whenever a channel's sound, vibration or importance changes.
 */
export const ALERT_CHANNELS = {
  soundVibrate: 'pomodoro-alert-sound-vibrate-v2',
  soundOnly: 'pomodoro-alert-sound-v2',
  vibrateOnly: 'pomodoro-alert-vibrate-v2',
  silent: 'pomodoro-alert-silent-v2',
} as const;
export const ONGOING_CHANNEL_ID = 'pomodoro-ongoing-v2';
export const GENERAL_CHANNEL_ID = 'general';
const OBSOLETE_CHANNEL_IDS = [
  'pomodoro',
  'pomodoro-sound',
  'pomodoro-vibrate',
  'pomodoro-silent',
  'pomodoro-ongoing',
];

export const ALERT_SOUND_FILE = 'timer_complete.wav';
export const ALERT_VIBRATION_PATTERN = [0, 500, 250, 500, 250, 500];
const ACCENT_COLOR = '#5A7868';

// Left behind by the previous implementation (random ids stored in AsyncStorage).
const LEGACY_SCHEDULED_ID_KEY = 'pomodoro:scheduledTimerNotificationId';
const LEGACY_ONGOING_ID = 'pomodoro-timer-ongoing';
const LEGACY_CATEGORY_ID = 'pomodoro-timer-actions';

export function alertChannelId(soundEnabled: boolean, vibrationEnabled: boolean): string {
  if (soundEnabled && vibrationEnabled) return ALERT_CHANNELS.soundVibrate;
  if (soundEnabled) return ALERT_CHANNELS.soundOnly;
  if (vibrationEnabled) return ALERT_CHANNELS.vibrateOnly;
  return ALERT_CHANNELS.silent;
}

/** Everything `armAlerts` needs, captured at call time. */
export interface AlertSnapshot {
  timer: PomodoroTimerState;
  pomodoroSettings: PomodoroSettings;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  use24HourClock: boolean;
}

export interface ArmOptions {
  /**
   * Pending alerts with a lower chain index are left alone: those phases have already
   * ended, and their alert may still be about to fire. 0 (the default) cancels every
   * alert that is not part of the new plan.
   */
  keepBelow?: number;
}

// ── Channels and categories ─────────────────────────────────────────────

/** Creates (or renames, after a language change) the Android channels. */
export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const t = (key: string) => i18n.t(key);

  const alertChannel = (name: string, sound: boolean, vibrate: boolean) =>
    Notifications.setNotificationChannelAsync(alertChannelId(sound, vibrate), {
      name,
      description: t('notifications.channelAlertsDescription'),
      importance: Notifications.AndroidImportance.HIGH,
      sound: sound ? ALERT_SOUND_FILE : null,
      enableVibrate: vibrate,
      vibrationPattern: vibrate ? ALERT_VIBRATION_PATTERN : null,
      lightColor: ACCENT_COLOR,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

  await Promise.all([
    alertChannel(t('notifications.channelAlertsSoundVibrate'), true, true),
    alertChannel(t('notifications.channelAlertsSound'), true, false),
    alertChannel(t('notifications.channelAlertsVibrate'), false, true),
    alertChannel(t('notifications.channelAlertsSilent'), false, false),
    Notifications.setNotificationChannelAsync(ONGOING_CHANNEL_ID, {
      name: t('notifications.channelOngoing'),
      description: t('notifications.channelOngoingDescription'),
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      enableVibrate: false,
      vibrationPattern: null,
      showBadge: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
    Notifications.setNotificationChannelAsync(GENERAL_CHANNEL_ID, {
      name: t('notifications.channelGeneral'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: ACCENT_COLOR,
      sound: 'default',
    }),
  ]);

  await Promise.all(
    OBSOLETE_CHANNEL_IDS.map((id) => Notifications.deleteNotificationChannelAsync(id).catch(() => undefined)),
  );
}

/**
 * Action buttons for the ongoing notification. They open the app, so they also work
 * after the app was killed: the response is then read on launch.
 */
export async function ensureNotificationCategories(): Promise<void> {
  const t = (key: string) => i18n.t(key);
  const opens = { opensAppToForeground: true };
  await Notifications.setNotificationCategoryAsync(POMODORO_CATEGORIES.running, [
    { identifier: POMODORO_ACTIONS.pause, buttonTitle: t('notifications.actionPause'), options: opens },
    { identifier: POMODORO_ACTIONS.skip, buttonTitle: t('notifications.actionSkip'), options: opens },
    {
      identifier: POMODORO_ACTIONS.stop,
      buttonTitle: t('notifications.actionStop'),
      options: { ...opens, isDestructive: true },
    },
  ]);
  await Notifications.setNotificationCategoryAsync(POMODORO_CATEGORIES.paused, [
    { identifier: POMODORO_ACTIONS.resume, buttonTitle: t('notifications.actionResume'), options: opens },
    {
      identifier: POMODORO_ACTIONS.stop,
      buttonTitle: t('notifications.actionStop'),
      options: { ...opens, isDestructive: true },
    },
  ]);
}

/** Removes notifications and keys left by the previous timer implementation. */
async function cleanupLegacyAlerts(): Promise<void> {
  try {
    const legacyId = await AsyncStorage.getItem(LEGACY_SCHEDULED_ID_KEY);
    if (legacyId) {
      await Notifications.cancelScheduledNotificationAsync(legacyId).catch(() => undefined);
      await AsyncStorage.removeItem(LEGACY_SCHEDULED_ID_KEY);
    }
    await Notifications.cancelScheduledNotificationAsync(LEGACY_ONGOING_ID).catch(() => undefined);
    await Notifications.dismissNotificationAsync(LEGACY_ONGOING_ID).catch(() => undefined);
    await Notifications.deleteNotificationCategoryAsync(LEGACY_CATEGORY_ID).catch(() => undefined);
  } catch {
    // Best effort.
  }
}

/** Channels, categories and legacy cleanup. Never asks for permission. */
export async function initializeAlerts(): Promise<void> {
  await ensureNotificationChannels();
  await ensureNotificationCategories();
  await cleanupLegacyAlerts();
}

// ── Content ─────────────────────────────────────────────────────────────

function phaseLabel(phase: PomodoroPhase): string {
  switch (toActivePhase(phase)) {
    case 'short_break':
      return i18n.t('notifications.shortBreak');
    case 'long_break':
      return i18n.t('notifications.longBreak');
    default:
      return i18n.t('notifications.focusTime');
  }
}

function clockTime(ms: number, use24HourClock: boolean): string {
  return format(new Date(ms), use24HourClock ? 'HH:mm' : 'h:mm a');
}

function phaseEndText(alert: PlannedAlert, snapshot: AlertSnapshot): { title: string; body: string } {
  const title =
    alert.phase === 'focus'
      ? i18n.t('notifications.focusComplete')
      : alert.phase === 'long_break'
        ? i18n.t('notifications.longBreakOver')
        : i18n.t('notifications.shortBreakOver');

  if (alert.continues) {
    const nextEndMs = alert.endMs + getPhaseDuration(alert.nextPhase, snapshot.pomodoroSettings) * 1000;
    return {
      title,
      body: i18n.t('notifications.nextPhaseStarted', {
        phase: phaseLabel(alert.nextPhase),
        time: clockTime(nextEndMs, snapshot.use24HourClock),
      }),
    };
  }
  if (alert.chainLimitReached) {
    return { title, body: i18n.t('notifications.chainLimitBody') };
  }
  const body =
    alert.phase === 'focus'
      ? i18n.t('notifications.focusCompleteBody')
      : alert.phase === 'long_break'
        ? i18n.t('notifications.longBreakOverBody')
        : i18n.t('notifications.shortBreakOverBody');
  return { title, body };
}

function alertContent(
  snapshot: AlertSnapshot,
  text: { title: string; body: string },
  data: Record<string, unknown>,
): Notifications.NotificationContentInput {
  const vibrate = snapshot.pomodoroSettings.vibrationEnabled;
  return {
    title: text.title,
    body: text.body,
    // iOS plays this file; Android plays the channel's sound.
    sound: snapshot.soundEnabled ? ALERT_SOUND_FILE : false,
    // Only used below Android 8; newer versions take vibration from the channel.
    ...(vibrate ? { vibrate: ALERT_VIBRATION_PATTERN } : {}),
    priority: Notifications.AndroidNotificationPriority.HIGH,
    // Breaks through Focus modes (entitlement in app.json).
    interruptionLevel: 'timeSensitive',
    color: ACCENT_COLOR,
    autoDismiss: true,
    data: { url: POMODORO_ROUTE, ...data },
  };
}

function alertTrigger(snapshot: AlertSnapshot, date: number): Notifications.NotificationTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
    channelId: alertChannelId(snapshot.soundEnabled, snapshot.pomodoroSettings.vibrationEnabled),
    // setAlarmClock(): never deferred by Doze or OEM battery savers. Falls back to an
    // inexact alarm when the exact-alarm permission is missing (see alert-permissions).
    delivery: 'alarmClock',
  };
}

function ongoingContent(snapshot: AlertSnapshot, nowMs: number): Notifications.NotificationContentInput {
  const { timer } = snapshot;
  const paused = timer.state === 'paused';
  const endMs = getPhaseEndMs(timer) ?? nowMs;
  return {
    title: phaseLabel(timer.phase),
    body: paused
      ? i18n.t('notifications.pausedRemaining', { time: formatClock(getRemainingSeconds(timer, nowMs)) })
      : i18n.t('notifications.endsAt', { time: clockTime(endMs, snapshot.use24HourClock) }),
    sound: false,
    priority: Notifications.AndroidNotificationPriority.LOW,
    sticky: true,
    autoDismiss: false,
    color: ACCENT_COLOR,
    categoryIdentifier: paused ? POMODORO_CATEGORIES.paused : POMODORO_CATEGORIES.running,
    data: {
      kind: NOTIFICATION_KIND.ongoing,
      url: POMODORO_ROUTE,
      phaseStartedAt: timer.startedAt,
    },
  };
}

// ── Arming ──────────────────────────────────────────────────────────────

// An ongoing notification is not posted when its phase ends this soon: the phase-end
// alert is about to replace it, and replacing that alert would cut its sound.
const ONGOING_MIN_LEAD_MS = 1500;

async function updateOngoing(snapshot: AlertSnapshot, nowMs: number): Promise<void> {
  const { timer } = snapshot;
  const endMs = getPhaseEndMs(timer);
  const wanted =
    snapshot.notificationsEnabled &&
    (timer.state === 'paused' ||
      (timer.state === 'running' && endMs !== null && endMs - nowMs > ONGOING_MIN_LEAD_MS));
  // Same id as the current phase's alert, so that alert replaces it when it fires.
  const ongoingId = wanted ? phaseEndId(timer.chainIndex) : null;

  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter(
          (n) =>
            n.request.content.data?.kind === NOTIFICATION_KIND.ongoing &&
            n.request.identifier !== ongoingId,
        )
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch {
    // Listing presented notifications is best effort.
  }

  if (ongoingId) {
    await Notifications.scheduleNotificationAsync({
      identifier: ongoingId,
      content: ongoingContent(snapshot, nowMs),
      trigger: { channelId: ONGOING_CHANNEL_ID },
    });
  }
}

async function applyAlerts(snapshot: AlertSnapshot, keepBelow: number): Promise<void> {
  const nowMs = Date.now();
  const fullPlan = snapshot.notificationsEnabled
    ? planAlerts(snapshot.timer, snapshot.pomodoroSettings)
    : [];
  // A DATE trigger in the past never fires; the store completes those phases itself.
  const plan = fullPlan.filter((alert) => alert.endMs > nowMs);
  const untouched = new Set(fullPlan.map((alert) => alert.chainIndex));
  const keep = snapshot.notificationsEnabled ? keepBelow : 0;

  await Promise.all(
    PHASE_END_IDS.map((id, index) =>
      index < keep || untouched.has(index)
        ? undefined
        : Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
    ),
  );

  if (Platform.OS === 'android') {
    await updateOngoing(snapshot, nowMs);
  }

  for (const alert of plan) {
    const text = phaseEndText(alert, snapshot);
    await Notifications.scheduleNotificationAsync({
      identifier: phaseEndId(alert.chainIndex),
      content: alertContent(snapshot, text, {
        kind: NOTIFICATION_KIND.phaseEnd,
        phase: alert.phase,
        chainIndex: alert.chainIndex,
      }),
      trigger: alertTrigger(snapshot, alert.endMs),
    });
  }
}

let pendingJob: { snapshot: AlertSnapshot; keepBelow: number } | null = null;
let worker: Promise<void> | null = null;

/**
 * Makes the scheduled phase-end alerts (and, on Android, the ongoing notification) match
 * `snapshot`. Serialized and idempotent; calls made while one is running are coalesced,
 * keeping the latest snapshot and the most thorough cancellation.
 */
export function armAlerts(snapshot: AlertSnapshot, options: ArmOptions = {}): Promise<void> {
  const keepBelow = Math.max(0, options.keepBelow ?? 0);
  pendingJob = {
    snapshot,
    keepBelow: pendingJob ? Math.min(pendingJob.keepBelow, keepBelow) : keepBelow,
  };
  if (!worker) {
    worker = (async () => {
      try {
        while (pendingJob) {
          const job = pendingJob;
          pendingJob = null;
          try {
            await applyAlerts(job.snapshot, job.keepBelow);
          } catch (error) {
            console.warn('[Pomodoro] Failed to update alerts:', error);
          }
        }
      } finally {
        worker = null;
      }
    })();
  }
  return worker;
}

/** Resolves once every queued `armAlerts` call has been applied. */
export function whenAlertsSettled(): Promise<void> {
  return worker ?? Promise.resolve();
}

/** Schedules a sample alert through the same channel and trigger as a real one. */
export async function scheduleTestAlert(snapshot: AlertSnapshot, delayMs = 10_000): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: TEST_ALERT_ID,
    content: alertContent(
      snapshot,
      { title: i18n.t('reliability.testAlertTitle'), body: i18n.t('reliability.testAlertBody') },
      { kind: NOTIFICATION_KIND.test },
    ),
    trigger: alertTrigger(snapshot, Date.now() + delayMs),
  });
}
