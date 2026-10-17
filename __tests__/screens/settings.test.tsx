jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@ui-kitten/components', () => {
  const { Text, View, TextInput, Pressable, Switch } = require('react-native');
  return {
    Text: (props: any) => <Text {...props}>{props.children}</Text>,
    Button: ({ children, onPress, ...props }: any) => <Pressable onPress={onPress} {...props}>{typeof children === 'string' ? <Text>{children}</Text> : children}</Pressable>,
    Input: ({ label, value, onChangeText, placeholder, ...props }: any) => <View>{label && <Text>{label}</Text>}<TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} {...props} /></View>,
    Card: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Toggle: ({ checked, onChange, ...props }: any) => <Switch value={checked} onValueChange={onChange} {...props} />,
    Divider: () => <View />,
  };
});

jest.mock('@/components/icon', () => ({ Icon: ({ name }: any) => { const { View } = require('react-native'); return <View testID={`icon-${name}`} />; } }));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => ({}) }));

jest.mock('@/components/animated/animated-badge', () => ({ LevelBadge: () => null, AchievementBadge: () => null }));
jest.mock('@/components/animated/animated-button', () => ({ AnimatedButton: ({ title, onPress }: any) => { const { Pressable, Text } = require('react-native'); return <Pressable onPress={onPress}><Text>{title}</Text></Pressable>; }, FAB: () => null }));
jest.mock('@/components/animated/animated-card', () => ({ AnimatedCard: ({ children }: any) => { const { View } = require('react-native'); return <View>{children}</View>; } }));
jest.mock('@/components/animated/animated-counter', () => ({ AnimatedCounter: ({ value }: any) => { const { Text } = require('react-native'); return <Text>{value}</Text>; } }));
jest.mock('@/components/animated/animated-progress-bar', () => ({ AnimatedProgressBar: () => null }));
jest.mock('@/components/animated/animated-checkbox', () => ({ AnimatedCheckbox: ({ checked, onToggle }: any) => { const { Pressable, Text } = require('react-native'); return <Pressable onPress={() => onToggle?.(!checked)}><Text>{checked ? '☑' : '☐'}</Text></Pressable>; } }));
jest.mock('@/components/common', () => ({ SectionHeader: ({ title }: any) => { const { Text } = require('react-native'); return <Text>{title}</Text>; }, EmptyState: ({ title }: any) => { const { Text } = require('react-native'); return <Text>{title}</Text>; }, SyncStatus: () => null }));
jest.mock('@/components/charts', () => ({ WeeklyChart: () => null, DistributionChart: () => null }));
jest.mock('@/components/dashboard', () => ({ DailySummaryModal: () => null }));
jest.mock('@/services/gamification/daily-summary', () => ({ shouldShowSummary: () => false, getDailySummaryData: jest.fn(), getMotivationalMessage: jest.fn(), markSummaryShown: jest.fn() }));
jest.mock('@/components/pomodoro', () => ({ CircularProgress: ({ children }: any) => { const { View } = require('react-native'); return <View>{children}</View>; } }));

jest.mock('@react-native-community/slider', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View {...props} />,
  };
});
jest.mock('@/services/i18n/i18n-config', () => ({ changeLanguage: jest.fn() }));
jest.mock('@/services/supabase/auth-service', () => ({ updateProfile: jest.fn().mockResolvedValue({}) }));

jest.mock('@/stores', () => ({
  useAuthStore: (sel: any) => sel({ status: 'unknown', profile: null }),
  useSettingsStore: (sel: any) => sel({
    settings: {
      notificationsEnabled: true,
      soundEnabled: true,
      hapticFeedbackEnabled: true,
      theme: 'system',
      language: 'en',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      weekStartsOn: 1,
      defaultView: 'list',
      hasCompletedOnboarding: true,
    },
    pomodoroSettings: {
      focusDuration: 1500,
      shortBreakDuration: 300,
      longBreakDuration: 900,
      sessionsUntilLongBreak: 4,
      autoStartBreaks: false,
      autoStartFocus: false,
      keepScreenAwake: true,
      vibrationEnabled: true,
    },
    updateSettings: jest.fn(),
    updatePomodoroSettings: jest.fn(),
    resetAllData: jest.fn(),
  }),
  useCategoryStore: (sel: any) => sel({
    categories: [{ id: 'cat1', name: 'Work', color: '#FF0000', icon: 'briefcase', isDefault: true }],
    addCategory: jest.fn(),
    deleteCategory: jest.fn(),
  }),
}));

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import SettingsScreen from '@/app/(tabs)/settings';

describe('Settings Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Settings title', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders Pomodoro Timer section', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Pomodoro Timer')).toBeTruthy();
    expect(screen.getByText('Focus Duration')).toBeTruthy();
    expect(screen.getByText('Short Break')).toBeTruthy();
    expect(screen.getByText('Long Break')).toBeTruthy();
  });

  it('renders Notifications section', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Notifications')).toBeTruthy();
    // The switches carry the row titles (the visible text is not read twice).
    expect(screen.getByRole('switch', { name: 'Enable Notifications' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Sound' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Vibration' })).toBeTruthy();
  });

  it('gives every switch, slider and option an accessible name or checked state', async () => {
    await render(<SettingsScreen />);
    for (const toggle of screen.getAllByRole('switch')) {
      expect(toggle.props.accessibilityLabel).toBeTruthy();
    }
    expect(screen.getByRole('radio', { name: 'Dark' }).props.accessibilityState).toEqual({ checked: false });
  });

  it('renders Appearance section', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Dark')).toBeTruthy();
  });

  it('renders Language section', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getAllByText('English').length).toBeGreaterThanOrEqual(1);
  });

  it('shows no account or sync UI when sync is not configured (store builds)', async () => {
    await render(<SettingsScreen />);
    expect(screen.queryByText('Account')).toBeNull();
    expect(screen.queryByText('Sign Out')).toBeNull();
    expect(screen.queryByText('Sign in to sync')).toBeNull();
    expect(screen.queryByText('Sync (experimental)')).toBeNull();
  });

  it('still offers Reset All Data', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Reset All Data')).toBeTruthy();
  });
});
