jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@ui-kitten/components', () => {
  const { Text, View, TextInput, Pressable, Switch } = require('react-native');
  return {
    Text: (props: any) => <Text {...props}>{props.children}</Text>,
    Button: ({ children, onPress, ...props }: any) => (
      <Pressable onPress={onPress} {...props}>
        {typeof children === 'string' ? <Text>{children}</Text> : children}
      </Pressable>
    ),
    Input: ({ label, value, onChangeText, placeholder, ...props }: any) => (
      <View>
        {label && <Text>{label}</Text>}
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} {...props} />
      </View>
    ),
    Card: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Toggle: ({ checked, onChange, ...props }: any) => <Switch value={checked} onValueChange={onChange} {...props} />,
    Divider: () => <View />,
    ApplicationProvider: ({ children }: any) => <>{children}</>,
  };
});

jest.mock('@/components/icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} />;
  },
}));

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));

jest.mock('@react-native-community/slider', () => {
  const { View } = require('react-native');
  return function MockSlider(props: any) {
    return <View testID="slider" {...props} />;
  };
});

const mockUpdatePomodoroSettings = jest.fn();

jest.mock('@/stores', () => ({
  useSettingsStore: (selector: any) => selector({
    pomodoroSettings: { focusDuration: 1500, shortBreakDuration: 300, longBreakDuration: 900, sessionsUntilLongBreak: 4 },
    updatePomodoroSettings: mockUpdatePomodoroSettings,
  }),
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import PomodoroSetupScreen from '@/app/(onboarding)/pomodoro-setup';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PomodoroSetupScreen', () => {
  it('renders Pomodoro Setup title or focus duration label', async () => {
    await render(<PomodoroSetupScreen />);
    expect(screen.getByText('Focus Duration')).toBeTruthy();
    expect(screen.getByText('Set Your Timer')).toBeTruthy();
  });

  it('renders 4 slider sections (focus, short break, long break, sessions)', async () => {
    await render(<PomodoroSetupScreen />);
    expect(screen.getByText('Focus Duration')).toBeTruthy();
    expect(screen.getByText('Short Break')).toBeTruthy();
    expect(screen.getByText('Long Break')).toBeTruthy();
    expect(screen.getByText('Sessions Until Long Break')).toBeTruthy();
  });

  it('renders Use Classic button', async () => {
    await render(<PomodoroSetupScreen />);
    expect(screen.getByText('Use Classic 25/5/15')).toBeTruthy();
  });

  it('renders Next/Continue button', async () => {
    await render(<PomodoroSetupScreen />);
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('navigates to category-selection on next', async () => {
    await render(<PomodoroSetupScreen />);
    await fireEvent.press(screen.getByText('Continue'));
    expect(mockUpdatePomodoroSettings).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/category-selection');
  });
});
