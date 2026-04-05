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

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import WelcomeScreen from '@/app/(onboarding)/welcome';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('WelcomeScreen', () => {
  it('renders Alpha Planner title', () => {
    render(<WelcomeScreen />);
    expect(screen.getByText('Alpha Planner')).toBeTruthy();
  });

  it('renders Focus. Plan. Grow. subtitle', () => {
    render(<WelcomeScreen />);
    expect(screen.getByText('Focus. Plan. Grow.')).toBeTruthy();
  });

  it('renders 3 feature cards', () => {
    render(<WelcomeScreen />);
    expect(screen.getByText('Pomodoro Timer')).toBeTruthy();
    expect(screen.getByText('Smart Tasks')).toBeTruthy();
    expect(screen.getByText('Achievements')).toBeTruthy();
  });

  it('renders get started button', () => {
    render(<WelcomeScreen />);
    expect(screen.getByText('Get Started')).toBeTruthy();
  });

  it('navigates to pomodoro-setup on button press', () => {
    render(<WelcomeScreen />);
    fireEvent.press(screen.getByText('Get Started'));
    expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/pomodoro-setup');
  });
});
