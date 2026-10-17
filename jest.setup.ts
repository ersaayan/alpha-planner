// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  dismissAllNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getPresentedNotificationsAsync: jest.fn().mockResolvedValue([]),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  deleteNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  setNotificationCategoryAsync: jest.fn().mockResolvedValue(null),
  deleteNotificationCategoryAsync: jest.fn().mockResolvedValue(true),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true }),
  getExactAlarmPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true }),
  requestExactAlarmPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true }),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  AndroidNotificationPriority: { MIN: 'min', LOW: 'low', DEFAULT: 'default', HIGH: 'high', MAX: 'max' },
  AndroidImportance: { UNKNOWN: 0, UNSPECIFIED: 1, NONE: 2, MIN: 3, LOW: 4, DEFAULT: 5, HIGH: 6, MAX: 7 },
  AndroidNotificationVisibility: { UNKNOWN: 0, PUBLIC: 1, PRIVATE: 2, SECRET: 3 },
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', TIME_INTERVAL: 'timeInterval' },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: () => `mock-uuid-${Math.random().toString(36).slice(2, 10)}`,
}));

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', regionCode: 'US' }],
}));

// Mock Supabase client. Sync is OFF by default, like store builds. A test that needs
// configured sync sets `isSyncConfigured = true` on this mock (see __tests__/helpers/sync.ts).
jest.mock('@/services/supabase/client', () => ({
  isSyncConfigured: false,
  supabase: null,
}));

// The native date/time picker: a plain view in tests (DateTimePickerAndroid.open is a spy).
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  const DateTimePicker = (props: Record<string, unknown>) => React.createElement(View, { testID: 'native-time-picker', ...props });
  return { __esModule: true, default: DateTimePicker, DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() } };
});

// Mock notification service
jest.mock('@/services/notifications', () => ({
  notificationService: {
    initialize: jest.fn().mockResolvedValue(true),
    checkPermission: jest.fn().mockResolvedValue(true),
    scheduleDailySummaryNotification: jest.fn().mockResolvedValue(undefined),
    cancelDailySummaryNotification: jest.fn().mockResolvedValue(undefined),
    syncDailySummary: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock i18n — t() returns the English translation value from en.json
jest.mock('react-i18next', () => ({
  useTranslation: () => {
    const en = require('./locales/en.json');
    return {
      t: (key: string, params?: Record<string, unknown>) => {
        let value = (en as Record<string, string>)[key] ?? key;
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
          });
        }
        return value;
      },
      i18n: { changeLanguage: jest.fn(), language: 'en' },
    };
  },
  initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

jest.mock('@/services/i18n/i18n-config', () => {
  const en = require('./locales/en.json');
  return {
    __esModule: true,
    default: {
      t: (key: string, params?: Record<string, unknown>) => {
        let value = (en as Record<string, string>)[key] ?? key;
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
          });
        }
        return value;
      },
      changeLanguage: jest.fn(),
      language: 'en',
    },
    changeLanguage: jest.fn(),
  };
});

// Silence console.warn in tests
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('[Pomodoro]')) return;
  originalWarn.apply(console, args);
};
