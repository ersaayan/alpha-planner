const mockPlatform = { OS: 'android' as 'android' | 'ios' };
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatform.OS;
    },
    select: (spec: Record<string, unknown>) => spec[mockPlatform.OS] ?? spec.default,
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  ALERT_CHANNELS,
  ALERT_SOUND_FILE,
  ALERT_VIBRATION_PATTERN,
  NOTIFICATION_KIND,
  ONGOING_CHANNEL_ID,
  PHASE_END_IDS,
  POMODORO_CATEGORIES,
  alertChannelId,
  armAlerts,
  ensureNotificationChannels,
  initializeAlerts,
  phaseEndId,
  whenAlertsSettled,
  type AlertSnapshot,
} from '@/services/notifications/pomodoro-alerts';
import type { PomodoroSettings, PomodoroTimerState } from '@/types';
import { DEFAULT_POMODORO_SETTINGS, INITIAL_TIMER_STATE } from '@/types';

const NOW = 1_700_000_000_000;
const MIN = 60_000;

const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const dismiss = Notifications.dismissNotificationAsync as jest.Mock;
const presented = Notifications.getPresentedNotificationsAsync as jest.Mock;

const running = (overrides: Partial<PomodoroTimerState> = {}): PomodoroTimerState => ({
  ...INITIAL_TIMER_STATE,
  phase: 'focus',
  state: 'running',
  totalTime: 1500,
  remainingTime: 1500,
  startedAt: NOW,
  ...overrides,
});

const snapshot = (
  timer: PomodoroTimerState,
  overrides: Partial<AlertSnapshot> & { settings?: Partial<PomodoroSettings> } = {},
): AlertSnapshot => ({
  timer,
  pomodoroSettings: { ...DEFAULT_POMODORO_SETTINGS, ...overrides.settings },
  notificationsEnabled: overrides.notificationsEnabled ?? true,
  soundEnabled: overrides.soundEnabled ?? true,
  use24HourClock: true,
});

type ScheduledRequest = {
  identifier: string;
  content: Notifications.NotificationContentInput;
  trigger: Record<string, unknown>;
};
const scheduled = (): ScheduledRequest[] => schedule.mock.calls.map(([request]) => request);
const phaseEnds = () => scheduled().filter((r) => r.content.data?.kind === NOTIFICATION_KIND.phaseEnd);
const ongoing = () => scheduled().filter((r) => r.content.data?.kind === NOTIFICATION_KIND.ongoing);
const cancelledIds = () => cancel.mock.calls.map(([id]) => id);

async function arm(snap: AlertSnapshot, keepBelow?: number) {
  await armAlerts(snap, keepBelow === undefined ? {} : { keepBelow });
  await whenAlertsSettled();
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.clearAllMocks();
  mockPlatform.OS = 'android';
  presented.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('phase-end alerts', () => {
  it('schedules the running phase with a DATE trigger carrying the Android channel', async () => {
    await arm(snapshot(running()));

    expect(phaseEnds()).toHaveLength(1);
    const [alert] = phaseEnds();
    expect(alert.identifier).toBe('pomodoro-phase-end-0');
    expect(alert.trigger).toEqual({
      type: 'date',
      date: NOW + 25 * MIN,
      channelId: ALERT_CHANNELS.soundVibrate,
      delivery: 'alarmClock',
    });
    expect(alert.content).not.toHaveProperty('channelId');
    expect(alert.content).toMatchObject({
      sound: ALERT_SOUND_FILE,
      interruptionLevel: 'timeSensitive',
      data: { kind: NOTIFICATION_KIND.phaseEnd, url: '/pomodoro', phase: 'focus', chainIndex: 0 },
    });
  });

  it('uses fixed identifiers that do not contain "timer"', () => {
    expect(PHASE_END_IDS).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((i) => `pomodoro-phase-end-${i}`));
    expect(PHASE_END_IDS.some((id) => id.includes('timer'))).toBe(false);
    expect(phaseEndId(99)).toBe('pomodoro-phase-end-7');
  });

  it('pre-schedules the whole auto-start chain up to the next manual start', async () => {
    await arm(snapshot(running(), { settings: { autoStartBreaks: true, autoStartFocus: true } }));

    const alerts = phaseEnds();
    expect(alerts.map((a) => a.identifier)).toEqual(PHASE_END_IDS);
    expect(alerts.map((a) => a.content.data?.phase)).toEqual([
      'focus', 'short_break', 'focus', 'short_break', 'focus', 'short_break', 'focus', 'long_break',
    ]);
    expect(alerts.map((a) => (a.trigger.date as number - NOW) / MIN)).toEqual([25, 30, 55, 60, 85, 90, 115, 130]);
    expect(alerts[0].content.body).toBe('Short Break started, ends at ' + new Date(NOW + 30 * MIN).toTimeString().slice(0, 5) + '.');
    expect(alerts[7].content.body).toBe(
      'Auto-start paused after several sessions. Open the app to start the next one.',
    );
  });

  it('stops the chain at the first phase that needs a manual start', async () => {
    await arm(snapshot(running(), { settings: { autoStartBreaks: true } }));
    expect(phaseEnds().map((a) => a.content.data?.phase)).toEqual(['focus', 'short_break']);
    expect(phaseEnds()[1].content.body).toBe('Ready to focus again?');
    // Positions beyond the chain are cleared.
    expect(cancelledIds()).toEqual(PHASE_END_IDS.slice(2));
  });

  it.each([
    [true, true, ALERT_CHANNELS.soundVibrate],
    [true, false, ALERT_CHANNELS.soundOnly],
    [false, true, ALERT_CHANNELS.vibrateOnly],
    [false, false, ALERT_CHANNELS.silent],
  ])('sound=%s vibration=%s uses channel %s', async (soundEnabled, vibrationEnabled, channel) => {
    expect(alertChannelId(soundEnabled, vibrationEnabled)).toBe(channel);
    await arm(snapshot(running(), { soundEnabled, settings: { vibrationEnabled } }));
    expect(phaseEnds()[0].trigger.channelId).toBe(channel);
    expect(phaseEnds()[0].content.sound).toBe(soundEnabled ? ALERT_SOUND_FILE : false);
  });

  it('does not schedule alerts that are already due', async () => {
    jest.setSystemTime(NOW + 26 * MIN);
    await arm(snapshot(running()), 0);
    expect(phaseEnds()).toHaveLength(0);
    // The due alert may still be about to fire: it is not cancelled either.
    expect(cancelledIds()).not.toContain('pomodoro-phase-end-0');
  });
});

describe('cancellation', () => {
  it.each(['paused', 'stopped'] as const)('a %s timer cancels every pending alert', async (state) => {
    const timer =
      state === 'paused' ? running({ state, pausedAt: NOW + MIN }) : { ...INITIAL_TIMER_STATE };
    await arm(snapshot(timer));
    expect(phaseEnds()).toHaveLength(0);
    expect(cancelledIds().sort()).toEqual([...PHASE_END_IDS].sort());
  });

  it('turning notifications off cancels everything, whatever keepBelow says', async () => {
    await arm(snapshot(running({ chainIndex: 3 }), { notificationsEnabled: false }), 3);
    expect(schedule).not.toHaveBeenCalled();
    expect(cancelledIds().sort()).toEqual([...PHASE_END_IDS].sort());
  });

  it('keeps the alerts of phases that already ended (keepBelow)', async () => {
    await arm(snapshot(running({ chainIndex: 1, phase: 'short_break', totalTime: 300 })), 1);
    expect(cancelledIds()).not.toContain('pomodoro-phase-end-0');
    expect(phaseEnds()[0].identifier).toBe('pomodoro-phase-end-1');
  });

  it('serializes and coalesces calls; the last snapshot wins', async () => {
    void armAlerts(snapshot(running()));
    void armAlerts(snapshot(running({ startedAt: NOW + MIN })));
    void armAlerts(snapshot(running({ startedAt: NOW + 2 * MIN })));
    await whenAlertsSettled();

    // The first call starts at once; the next two collapse into one.
    expect(phaseEnds()).toHaveLength(2);
    expect(phaseEnds()[1].trigger.date).toBe(NOW + 27 * MIN);
  });
});

describe('ongoing notification (Android)', () => {
  it('shares the current phase alert id so the alert replaces it', async () => {
    await arm(snapshot(running({ chainIndex: 2 })));
    const [notification] = ongoing();
    expect(notification.identifier).toBe('pomodoro-phase-end-2');
    expect(notification.trigger).toEqual({ channelId: ONGOING_CHANNEL_ID });
    expect(notification.content).toMatchObject({
      sticky: true,
      autoDismiss: false,
      categoryIdentifier: POMODORO_CATEGORIES.running,
    });
    expect(notification.content.body).toMatch(/^Ends at \d\d:\d\d$/);
    // Posted before the alert with the same id is scheduled.
    const order = scheduled().map((r) => r.content.data?.kind);
    expect(order.indexOf(NOTIFICATION_KIND.ongoing)).toBeLessThan(order.indexOf(NOTIFICATION_KIND.phaseEnd));
  });

  it('shows the remaining time while paused', async () => {
    await arm(snapshot(running({ state: 'paused', pausedAt: NOW + 10 * MIN })));
    expect(ongoing()[0].content).toMatchObject({
      body: 'Paused · 15:00 left',
      categoryIdentifier: POMODORO_CATEGORIES.paused,
    });
  });

  it('is not posted when the phase is about to end', async () => {
    jest.setSystemTime(NOW + 25 * MIN - 500);
    await arm(snapshot(running()));
    expect(ongoing()).toHaveLength(0);
  });

  it('dismisses stale ongoing notifications but never phase-end alerts', async () => {
    presented.mockResolvedValue([
      { request: { identifier: 'pomodoro-phase-end-3', content: { data: { kind: NOTIFICATION_KIND.ongoing } } } },
      { request: { identifier: 'pomodoro-phase-end-0', content: { data: { kind: NOTIFICATION_KIND.phaseEnd } } } },
    ]);
    await arm(snapshot(running({ chainIndex: 1 })));
    expect(dismiss.mock.calls.map(([id]) => id)).toEqual(['pomodoro-phase-end-3']);
  });

  it('is not posted on iOS', async () => {
    mockPlatform.OS = 'ios';
    await arm(snapshot(running()));
    expect(ongoing()).toHaveLength(0);
    expect(phaseEnds()).toHaveLength(1);
  });
});

describe('setup', () => {
  it('creates versioned channels with the sound file and a vibration pattern, and deletes old ones', async () => {
    await ensureNotificationChannels();
    const channels = Object.fromEntries(
      (Notifications.setNotificationChannelAsync as jest.Mock).mock.calls.map(([id, config]) => [id, config]),
    );
    expect(channels[ALERT_CHANNELS.soundVibrate]).toMatchObject({
      sound: ALERT_SOUND_FILE,
      enableVibrate: true,
      vibrationPattern: ALERT_VIBRATION_PATTERN,
      name: 'Timer alerts (sound and vibration)',
    });
    expect(channels[ALERT_CHANNELS.vibrateOnly]).toMatchObject({ sound: null, enableVibrate: true });
    expect(channels[ALERT_CHANNELS.silent]).toMatchObject({ sound: null, enableVibrate: false });
    expect(channels[ONGOING_CHANNEL_ID]).toMatchObject({ sound: null, enableVibrate: false });
    const deleted = (Notifications.deleteNotificationChannelAsync as jest.Mock).mock.calls.map(([id]) => id);
    expect(deleted).toEqual(expect.arrayContaining(['pomodoro', 'pomodoro-sound', 'pomodoro-ongoing']));
  });

  it('creates no channels on iOS', async () => {
    mockPlatform.OS = 'ios';
    await ensureNotificationChannels();
    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('cancels the alert left by the old implementation and never asks for permission', async () => {
    await AsyncStorage.setItem('pomodoro:scheduledTimerNotificationId', 'random-legacy-id');
    await initializeAlerts();
    expect(cancelledIds()).toContain('random-legacy-id');
    expect(await AsyncStorage.getItem('pomodoro:scheduledTimerNotificationId')).toBeNull();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('gives action buttons opensAppToForeground so they work after the app was killed', async () => {
    await initializeAlerts();
    const actions = (Notifications.setNotificationCategoryAsync as jest.Mock).mock.calls.flatMap(
      ([, list]) => list,
    );
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a: { options: { opensAppToForeground: boolean } }) => a.options.opensAppToForeground)).toBe(true);
  });
});
