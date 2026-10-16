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

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(),
  deactivateKeepAwake: jest.fn(),
}));
jest.mock('@/constants/animations', () => ({
  SpringConfig: { default: { damping: 10, stiffness: 100 }, bouncy: { damping: 5, stiffness: 150 } },
}));

const mockStartTimer = jest.fn();
const mockPauseTimer = jest.fn();
const mockResumeTimer = jest.fn();
const mockStopTimer = jest.fn();
const mockSkipToNextPhase = jest.fn();

jest.mock('@/stores', () => ({
  usePomodoroStore: (sel: any) => sel({
    timer: { state: 'stopped', phase: 'focus', remainingTime: 1500, totalTime: 1500, sessionsCompleted: 0, linkedTodoId: null, startedAt: null, pausedAt: null, totalPausedDuration: 0, notificationId: null, currentSessionId: null },
    startTimer: mockStartTimer,
    pauseTimer: mockPauseTimer,
    resumeTimer: mockResumeTimer,
    stopTimer: mockStopTimer,
    skipToNextPhase: mockSkipToNextPhase,
    getProgress: () => 0,
    linkTodo: jest.fn(),
  }),
  useSettingsStore: (sel: any) => sel({ pomodoroSettings: { focusDuration: 1500, sessionsUntilLongBreak: 4, keepScreenAwake: true, autoStartBreaks: false, autoStartFocus: false, vibrationEnabled: true, shortBreakDuration: 300, longBreakDuration: 900 }, settings: { keepScreenAwake: true } }),
  useTodoStore: (sel: any) => sel({ todos: [] }),
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import PomodoroScreen from '@/app/(tabs)/pomodoro';

describe('Pomodoro Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders timer display with time', async () => {
    await render(<PomodoroScreen />);
    expect(screen.getByText('25:00')).toBeTruthy();
  });

  it('renders Start button when stopped', async () => {
    await render(<PomodoroScreen />);
    expect(screen.getByText('Start Focus')).toBeTruthy();
  });

  it('renders session counter', async () => {
    await render(<PomodoroScreen />);
    expect(screen.getByText('Session 1')).toBeTruthy();
  });

  it('renders phase label (Focus/Break)', async () => {
    await render(<PomodoroScreen />);
    expect(screen.getByText('Focus Time')).toBeTruthy();
  });

  it('start button calls startTimer', async () => {
    await render(<PomodoroScreen />);
    await fireEvent.press(screen.getByText('Start Focus'));
    expect(mockStartTimer).toHaveBeenCalled();
  });

  it('renders skip button when timer is running', async () => {
    jest.spyOn(require('@/stores'), 'usePomodoroStore').mockImplementation((sel: any) => sel({
      timer: { state: 'running', phase: 'focus', remainingTime: 1200, totalTime: 1500, sessionsCompleted: 0, linkedTodoId: null, startedAt: null, pausedAt: null, totalPausedDuration: 0, notificationId: null, currentSessionId: null },
      startTimer: mockStartTimer,
      pauseTimer: mockPauseTimer,
      resumeTimer: mockResumeTimer,
      stopTimer: mockStopTimer,
      skipToNextPhase: mockSkipToNextPhase,
      getProgress: () => 0.2,
      linkTodo: jest.fn(),
    }));
    await render(<PomodoroScreen />);
    expect(screen.getByText(/Skip to/)).toBeTruthy();
  });
});
