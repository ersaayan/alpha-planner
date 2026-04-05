// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  setNotificationHandler: jest.fn(),
  AndroidNotificationPriority: { HIGH: 'high', DEFAULT: 'default' },
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: () => `mock-uuid-${Math.random().toString(36).slice(2, 10)}`,
}));

// Mock expo-task-manager
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn().mockResolvedValue(false),
}));

// Mock expo-background-fetch
jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: jest.fn().mockResolvedValue(undefined),
  unregisterTaskAsync: jest.fn().mockResolvedValue(undefined),
  BackgroundFetchResult: { NoData: 1, NewData: 2, Failed: 3 },
}));

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', regionCode: 'US' }],
}));

// Mock Supabase client
jest.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

// Mock notification service
jest.mock('@/services/notifications', () => ({
  notificationService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    showTimerNotification: jest.fn(),
    dismissTimerNotification: jest.fn(),
    sendTimerCompleteNotification: jest.fn(),
    setActionCallbacks: jest.fn(),
    scheduleDailySummaryNotification: jest.fn(),
  },
}));

// Mock background service
jest.mock('@/services/background', () => ({
  scheduleTimerNotification: jest.fn().mockResolvedValue(undefined),
  cancelScheduledTimerNotifications: jest.fn().mockResolvedValue(undefined),
  registerPomodoroBackgroundTask: jest.fn().mockResolvedValue(undefined),
  unregisterPomodoroBackgroundTask: jest.fn().mockResolvedValue(undefined),
}));

// Silence console.warn in tests
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('[Pomodoro]') || msg.includes('[PomoBgTask]')) return;
  originalWarn.apply(console, args);
};
