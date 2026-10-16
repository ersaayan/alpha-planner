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

let mockIsFocused = true;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useIsFocused: () => mockIsFocused,
}));
jest.mock('expo-router/js-tabs', () => ({ BottomTabBarHeightContext: require('react').createContext(undefined) }));

jest.mock('@/components/animated/animated-button', () => ({ AnimatedButton: ({ title, onPress }: any) => { const { Pressable, Text } = require('react-native'); return <Pressable onPress={onPress}><Text>{title}</Text></Pressable>; }, FAB: () => null }));
jest.mock('@/components/animated/animated-card', () => ({ AnimatedCard: ({ children }: any) => { const { View } = require('react-native'); return <View>{children}</View>; } }));
jest.mock('@/components/pomodoro', () => ({ CircularProgress: ({ children, progress }: any) => { const { View } = require('react-native'); return <View testID="circle" accessibilityValue={{ now: Math.round(progress * 100) }}>{children}</View>; } }));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn().mockResolvedValue(undefined),
  deactivateKeepAwake: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/constants/animations', () => ({
  SpringConfig: { default: { damping: 10, stiffness: 100 }, bouncy: { damping: 5, stiffness: 150 } },
}));

let mockPermissions: any = { notifications: 'granted', canAskAgain: true, exactAlarms: true, alertChannelEnabled: true };
jest.mock('@/hooks/use-alert-permissions', () => ({
  useAlertPermissions: () => ({ permissions: mockPermissions, refresh: jest.fn() }),
}));
const mockRequestPermission = jest.fn().mockResolvedValue('granted');
jest.mock('@/services/notifications/alert-permissions', () => ({
  requestNotificationPermission: (...args: unknown[]) => mockRequestPermission(...args),
  requestExactAlarmPermission: jest.fn().mockResolvedValue(true),
  openChannelSettings: jest.fn(),
}));
jest.mock('@/services/notifications/pomodoro-alerts', () => ({ alertChannelId: () => 'channel' }));

const mockStartTimer = jest.fn();
const mockPauseTimer = jest.fn();
const mockResumeTimer = jest.fn();
const mockStopTimer = jest.fn();
const mockSkipToNextPhase = jest.fn();

const stoppedTimer = { state: 'stopped', phase: 'focus', remainingTime: 1500, totalTime: 1500, sessionsCompleted: 0, linkedTodoId: null, startedAt: null, pausedAt: null, totalPausedDuration: 0, chainIndex: 0, currentSessionId: null };
let mockTimer: any = stoppedTimer;
let mockRemaining = 1500;
let mockNotificationsEnabled = true;

jest.mock('@/stores', () => ({
  usePomodoroStore: (sel: any) => sel({
    timer: mockTimer,
    startTimer: mockStartTimer,
    pauseTimer: mockPauseTimer,
    resumeTimer: mockResumeTimer,
    stopTimer: mockStopTimer,
    skipToNextPhase: mockSkipToNextPhase,
    linkTodo: jest.fn(),
    refreshAlerts: jest.fn(),
  }),
  usePomodoroClock: (sel: any) => sel({ remainingSeconds: mockRemaining }),
  useSettingsStore: (sel: any) => sel({
    pomodoroSettings: { focusDuration: 1500, sessionsUntilLongBreak: 4, keepScreenAwake: true, autoStartBreaks: false, autoStartFocus: false, vibrationEnabled: true, shortBreakDuration: 300, longBreakDuration: 900 },
    settings: { notificationsEnabled: mockNotificationsEnabled, soundEnabled: true },
  }),
  useTodoStore: (sel: any) => sel({ todos: [] }),
}));

import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { activateKeepAwakeAsync } from 'expo-keep-awake';
import PomodoroScreen from '@/app/(tabs)/pomodoro';

describe('Pomodoro Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTimer = stoppedTimer;
    mockRemaining = 1500;
    mockIsFocused = true;
    mockNotificationsEnabled = true;
    mockPermissions = { notifications: 'granted', canAskAgain: true, exactAlarms: true, alertChannelEnabled: true };
  });

  it('renders the time from the live clock with tabular digits', async () => {
    mockRemaining = 1234;
    await render(<PomodoroScreen />);
    const time = screen.getByText('20:34');
    expect(StyleSheet.flatten(time.props.style).fontVariant).toEqual(['tabular-nums']);
  });

  it('computes progress from the selected remaining time', async () => {
    mockTimer = { ...stoppedTimer, state: 'running', startedAt: 1 };
    mockRemaining = 375;
    await render(<PomodoroScreen />);
    expect(screen.getByTestId('circle').props.accessibilityValue.now).toBe(75);
  });

  it('renders Start, session counter and phase label', async () => {
    await render(<PomodoroScreen />);
    expect(screen.getByText('Start Focus')).toBeTruthy();
    expect(screen.getByText('Session 1')).toBeTruthy();
    expect(screen.getByText('Focus Time')).toBeTruthy();
  });

  it('start button calls startTimer', async () => {
    await render(<PomodoroScreen />);
    await fireEvent.press(screen.getByText('Start Focus'));
    expect(mockStartTimer).toHaveBeenCalled();
  });

  it('asks for notification permission with an explanation at the first Start', async () => {
    mockPermissions = { ...mockPermissions, notifications: 'undetermined' };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.[1]?.onPress?.();
    });
    await render(<PomodoroScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Start Focus'));
    });

    expect(alert).toHaveBeenCalledWith('Get alerted when time is up?', expect.any(String), expect.any(Array), expect.any(Object));
    expect(mockRequestPermission).toHaveBeenCalled();
    expect(mockStartTimer).toHaveBeenCalled();
  });

  it('shows a banner when notifications are denied', async () => {
    mockPermissions = { ...mockPermissions, notifications: 'denied', canAskAgain: false };
    await render(<PomodoroScreen />);
    expect(screen.getByText(/Notifications are off/)).toBeTruthy();
    expect(screen.getByText('Open settings')).toBeTruthy();
  });

  it('shows no banner when the in-app notifications toggle is off', async () => {
    mockNotificationsEnabled = false;
    mockPermissions = { ...mockPermissions, notifications: 'denied' };
    await render(<PomodoroScreen />);
    expect(screen.queryByText(/Notifications are off/)).toBeNull();
  });

  it('renders skip and pause controls while running', async () => {
    mockTimer = { ...stoppedTimer, state: 'running', startedAt: 1 };
    await render(<PomodoroScreen />);
    expect(screen.getByText('Skip to Break')).toBeTruthy();
    await fireEvent.press(screen.getByText('Pause'));
    expect(mockPauseTimer).toHaveBeenCalled();
  });

  it('keeps the screen awake only while focused and running', async () => {
    mockTimer = { ...stoppedTimer, state: 'running', startedAt: 1 };
    mockIsFocused = false;
    await render(<PomodoroScreen />);
    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();

    mockIsFocused = true;
    await render(<PomodoroScreen />);
    expect(activateKeepAwakeAsync).toHaveBeenCalledWith('pomodoro-timer');
  });
});
