/**
 * Everything the timer alerts depend on outside the app: notification permission,
 * the Android alert channel, exact alarms and battery optimisation.
 *
 * Exact alarms use expo-notifications' own API (58.1.1+), which wraps
 * AlarmManager.canScheduleExactAlarms() and ACTION_REQUEST_SCHEDULE_EXACT_ALARM, so no
 * native module is needed. System settings screens are opened with RN's
 * Linking.sendIntent (Android only).
 */
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { alertChannelId, ensureNotificationChannels } from './pomodoro-alerts';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export interface AlertPermissions {
  notifications: PermissionState;
  /** False when the OS will not show the prompt again; only Settings can change it. */
  canAskAgain: boolean;
  /** Android 12+: whether alarms fire at the exact time. Always true elsewhere. */
  exactAlarms: boolean;
  /** Android: whether the user switched off the channel the alerts use. Null elsewhere. */
  alertChannelEnabled: boolean | null;
}

export const DEFAULT_ALERT_PERMISSIONS: AlertPermissions = {
  notifications: 'undetermined',
  canAskAgain: true,
  exactAlarms: true,
  alertChannelEnabled: null,
};

function toState(response: Notifications.NotificationPermissionsStatus): PermissionState {
  if (response.granted) return 'granted';
  if (Platform.OS === 'ios' && response.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return 'granted';
  }
  return response.status === 'undetermined' ? 'undetermined' : 'denied';
}

export async function getAlertPermissions(options: {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}): Promise<AlertPermissions> {
  const permissions = await Notifications.getPermissionsAsync();
  let exactAlarms = true;
  let alertChannelEnabled: boolean | null = null;

  if (Platform.OS === 'android') {
    try {
      exactAlarms = (await Notifications.getExactAlarmPermissionsAsync()).granted;
    } catch {
      exactAlarms = true;
    }
    try {
      const channel = await Notifications.getNotificationChannelAsync(
        alertChannelId(options.soundEnabled, options.vibrationEnabled),
      );
      alertChannelEnabled = channel ? channel.importance !== Notifications.AndroidImportance.NONE : null;
    } catch {
      alertChannelEnabled = null;
    }
  }

  return {
    notifications: toState(permissions),
    canAskAgain: permissions.canAskAgain,
    exactAlarms,
    alertChannelEnabled,
  };
}

/** Shows the OS prompt. Channels are created first, as Android 13+ requires. */
export async function requestNotificationPermission(): Promise<PermissionState> {
  await ensureNotificationChannels();
  const response = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return toState(response);
}

/**
 * Android 12+: opens "Alarms & reminders" for this app and resolves when the user
 * comes back. Android 14+ denies the permission by default for new installs.
 */
export async function requestExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    await Linking.openSettings();
    return false;
  }
}

const packageName = () => Constants.expoConfig?.android?.package ?? 'com.ersaayan.alphaplanner';

export async function openAppSettings(): Promise<void> {
  await Linking.openSettings();
}

/** The system notification settings of one channel, falling back to the app's settings. */
export async function openChannelSettings(channelId: string): Promise<void> {
  if (Platform.OS !== 'android') return openAppSettings();
  try {
    await Linking.sendIntent('android.settings.CHANNEL_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: packageName() },
      { key: 'android.provider.extra.CHANNEL_ID', value: channelId },
    ]);
  } catch {
    await openAppSettings();
  }
}

/**
 * The list where the user can exclude the app from battery optimisation. Deliberately
 * not ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, which Play policy restricts.
 */
export async function openBatteryOptimizationSettings(): Promise<void> {
  try {
    await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch {
    await openAppSettings();
  }
}

/** dontkillmyapp.com page for this phone's maker (OEM battery killers). */
export function dontKillMyAppUrl(): string {
  const constants = Platform.constants as { Manufacturer?: string; Brand?: string } | undefined;
  const maker = (constants?.Manufacturer ?? constants?.Brand ?? '').trim().toLowerCase();
  const slug = maker.replace(/[^a-z0-9-]/g, '');
  return slug ? `https://dontkillmyapp.com/${slug}` : 'https://dontkillmyapp.com';
}
