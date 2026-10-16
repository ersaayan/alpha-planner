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
jest.mock('@/components/animated/animated-counter', () => ({ AnimatedCounter: ({ value }: any) => { const { Text } = require('react-native'); return <Text>{value}</Text>; }, XPCounter: () => null, StreakCounter: () => null }));
jest.mock('@/components/animated/animated-progress-bar', () => ({ AnimatedProgressBar: () => null }));
jest.mock('@/components/animated/animated-checkbox', () => ({ AnimatedCheckbox: ({ checked, onToggle }: any) => { const { Pressable, Text } = require('react-native'); return <Pressable onPress={() => onToggle?.(!checked)}><Text>{checked ? '☑' : '☐'}</Text></Pressable>; } }));
jest.mock('@/components/common', () => ({ SectionHeader: ({ title }: any) => { const { Text } = require('react-native'); return <Text>{title}</Text>; }, EmptyState: ({ title }: any) => { const { Text } = require('react-native'); return <Text>{title}</Text>; }, SyncStatus: () => null }));
jest.mock('@/components/charts', () => ({ WeeklyChart: () => null, DistributionChart: () => null }));
jest.mock('@/components/dashboard', () => ({ DailySummaryModal: () => null }));
jest.mock('@/services/gamification/daily-summary', () => ({ shouldShowSummary: () => false, getDailySummaryData: jest.fn(), getMotivationalMessage: jest.fn(), markSummaryShown: jest.fn() }));
jest.mock('@/components/pomodoro', () => ({ CircularProgress: ({ children }: any) => { const { View } = require('react-native'); return <View>{children}</View>; } }));

jest.mock('@/stores', () => ({
  useAuthStore: (sel: any) => sel({ profile: { displayName: 'Fatma' } }),
  useGamificationStore: (sel: any) => sel({
    stats: { level: 5, currentStreak: 3, totalPomodoros: 10, totalXp: 500, currentXp: 200, totalFocusTime: 3600, totalTasksCompleted: 5, longestStreak: 7 },
    getXpProgress: () => ({ current: 200, required: 500, percentage: 40 }),
    unlockedAchievements: [],
    combo: { sessionCombo: 0, dailyComboStreak: 0, lastDailyComboDate: null },
    prestige: { count: 0, currentSeasonStart: '2026-04', history: [] },
    isAchievementUnlocked: () => false,
  }),
  usePomodoroStore: (sel: any) => sel({ sessions: [], timer: { state: 'stopped', phase: 'idle', remainingTime: 1500 } }),
  useTodoStore: (sel: any) => sel({ todos: [] }),
  useSettingsStore: (sel: any) => sel({ settings: { dateFormat: 'DD/MM/YYYY' } }),
}));
jest.mock('@/constants/gamification', () => ({
  getLevelTitle: () => 'Young Leaf',
  getLevelTier: () => 'Seedling',
  ACHIEVEMENTS: [
    { id: 'a1', name: 'First Focus', description: 'Complete your first pomodoro', icon: 'clock', xpReward: 50, category: 'pomodoro', isSecret: false, condition: () => true },
  ],
}));

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import StatsScreen from '@/app/(tabs)/stats';

describe('Stats Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Statistics title', async () => {
    await render(<StatsScreen />);
    expect(screen.getByText('Statistics')).toBeTruthy();
  });

  it('renders level with tier display', async () => {
    await render(<StatsScreen />);
    expect(screen.getByText(/Seedling/)).toBeTruthy();
    expect(screen.getByText(/Young Leaf/)).toBeTruthy();
  });

  it('renders stat cards (pomodoros, focus time, tasks, streak)', async () => {
    await render(<StatsScreen />);
    expect(screen.getByText('Pomodoros')).toBeTruthy();
    expect(screen.getByText('Focus Time')).toBeTruthy();
    expect(screen.getByText('Tasks Done')).toBeTruthy();
    expect(screen.getByText('Day Streak')).toBeTruthy();
  });

  it('renders achievements section', async () => {
    await render(<StatsScreen />);
    expect(screen.getByText('Achievements')).toBeTruthy();
  });

  it('renders empty state for new user', async () => {
    jest.spyOn(require('@/stores'), 'useGamificationStore').mockImplementation((sel: any) => sel({
      stats: { level: 1, currentStreak: 0, totalPomodoros: 0, totalXp: 0, currentXp: 0, totalFocusTime: 0, totalTasksCompleted: 0, longestStreak: 0 },
      getXpProgress: () => ({ current: 0, required: 100, percentage: 0 }),
      unlockedAchievements: [],
      combo: { sessionCombo: 0, dailyComboStreak: 0, lastDailyComboDate: null },
      prestige: { count: 0, currentSeasonStart: '2026-04', history: [] },
      isAchievementUnlocked: () => false,
    }));
    await render(<StatsScreen />);
    expect(screen.getByText('Start Your Journey!')).toBeTruthy();
  });
});
