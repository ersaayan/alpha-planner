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
  useGamificationStore: (sel: any) => sel({ stats: { level: 5, currentStreak: 3, totalPomodoros: 10, totalXp: 500, currentXp: 200, totalFocusTime: 3600, totalTasksCompleted: 5, longestStreak: 7 }, getXpProgress: () => ({ current: 200, required: 500, percentage: 40 }), combo: { sessionCombo: 0, dailyComboStreak: 0, lastDailyComboDate: null, lastSessionAt: null }, prestige: { count: 0, currentSeasonStart: '2026-04', history: [], acknowledgedMonth: null }, dailyStats: [], unlockedAchievements: [], isAchievementUnlocked: () => false }),
  usePomodoroStore: (sel: any) => sel({ timer: { state: 'stopped', phase: 'idle', remainingTime: 1500, totalTime: 1500, sessionsCompleted: 0, linkedTodoId: null, startedAt: null, pausedAt: null, totalPausedDuration: 0, chainIndex: 0, currentSessionId: null }, sessions: [] }),
  usePomodoroClock: (sel: any) => sel({ remainingSeconds: 1500 }),
  useTodoStore: (sel: any) => sel({ todos: [{ id: '1', title: 'Test Task', status: 'pending', priority: 'medium', categoryId: null, subtasks: [], createdAt: '2026-04-05', updatedAt: '2026-04-05', order: 0 }] }),
  useSettingsStore: (sel: any) => sel({ settings: { dateFormat: 'DD/MM/YYYY' }, pomodoroSettings: { longBreakDuration: 900 } }),
  useCategoryStore: (sel: any) => sel({ categories: [{ id: 'work', name: 'Work', color: '#000', icon: null, isDefault: true, order: 0, createdAt: '' }], getCategoryColor: () => '#FF0000' }),
  useDailyQuestsStore: (sel: any) => {
    const today = jest.requireActual('@/utils/date').getDateKey();
    return sel({
      quests: [
        { id: 'q1', date: today, questType: 'complete_in_category', questParams: { categoryId: 'work' }, targetValue: 2, currentValue: 1, isCompleted: false, xpReward: 20 },
        { id: 'q2', date: today, questType: 'start_early', questParams: { beforeHour: 8 }, targetValue: 1, currentValue: 1, isCompleted: true, xpReward: 20 },
      ],
    });
  },
  useWeeklyGoalsStore: (sel: any) => {
    const week = jest.requireActual('@/utils/date').getWeekKey();
    return sel({
      goals: [{ id: 'g1', weekStart: week, goalType: 'system', goalParams: { metric: 'focus_hours' }, targetValue: 5, currentValue: 2.25, isCompleted: false, xpReward: 100 }],
      setPersonalGoal: jest.fn(() => true),
    });
  },
}));
jest.mock('@/utils/date', () => ({ ...jest.requireActual('@/utils/date'), formatDate: () => '05/04/2026' }));

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import HomeScreen from '@/app/(tabs)/index';

describe('Dashboard Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders personalized greeting with display name', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText(/Welcome, Fatma/)).toBeTruthy();
  });

  it('renders level tier and title', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText(/Seedling/)).toBeTruthy();
    expect(screen.getByText(/Young Leaf/)).toBeTruthy();
  });

  it('renders XP progress section', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('Experience')).toBeTruthy();
    expect(screen.getByText(/500 XP/)).toBeTruthy();
  });

  it('renders quick stats', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('Day Streak')).toBeTruthy();
    expect(screen.getByText('Done Today')).toBeTruthy();
    expect(screen.getByText('Pomodoros')).toBeTruthy();
  });

  it('renders active tasks section', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('Active Tasks')).toBeTruthy();
    expect(screen.getByText('Test Task')).toBeTruthy();
  });

  it('renders quick action buttons (New Task, Start Focus)', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('New Task')).toBeTruthy();
    expect(screen.getByText('Start Focus')).toBeTruthy();
  });

  it('renders timer status section', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('Quick Actions')).toBeTruthy();
  });

  it('shows max level only at level 50, never "Infinity XP"', async () => {
    const stats = { level: 50, currentStreak: 0, totalPomodoros: 0, totalXp: 600000, currentXp: 0, totalFocusTime: 0, totalTasksCompleted: 0, longestStreak: 0 };
    jest.spyOn(require('@/stores'), 'useGamificationStore').mockImplementation((sel: any) => sel({
      stats,
      getXpProgress: () => ({ current: 1000, required: 0, percentage: 100, isMaxLevel: true }),
      combo: { sessionCombo: 0, dailyComboStreak: 0, lastDailyComboDate: null },
      prestige: { count: 0, currentSeasonStart: '2026-04', history: [], acknowledgedMonth: null },
      dailyStats: [],
      unlockedAchievements: [],
      isAchievementUnlocked: () => false,
    }));
    await render(<HomeScreen />);
    expect(screen.getByText(/Max Level Reached!/)).toBeTruthy();
    expect(screen.queryByText(/Infinity/)).toBeNull();
    expect(screen.getByText(/Forest Master/)).toBeTruthy();
  });

  it('below level 50 shows the XP to the next level', async () => {
    await render(<HomeScreen />);
    expect(screen.queryByText(/Max Level/)).toBeNull();
    expect(screen.getByText('300 XP to Level 6')).toBeTruthy();
  });

  it('explains the monthly season on the dashboard', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText(/season$/)).toBeTruthy();
    expect(screen.getByText(/Season rewards earned so far: 0 of 6/)).toBeTruthy();
  });

  it("shows today's quests, this week's goals and how to start a combo", async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('Daily Quests')).toBeTruthy();
    expect(screen.getByText('Complete 2 task(s) in Work')).toBeTruthy();
    expect(screen.getByText('Start a focus session before 08:00')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.getByText('Weekly Goals')).toBeTruthy();
    expect(screen.getByText('2.3 / 5')).toBeTruthy();
    expect(screen.getByText('Set Personal Goal')).toBeTruthy();
    expect(screen.getByText(/daily combo/)).toBeTruthy();
  });
});
