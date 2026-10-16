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

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));

let mockSignIn = jest.fn();

const mockState = () => ({
  signIn: mockSignIn,
  signUp: jest.fn(),
  isLoading: false,
  error: null,
});

jest.mock('@/stores/auth-store', () => {
  return {
    useAuthStore: Object.assign(
      (selector?: any) => {
        const state = mockState();
        return selector ? selector(state) : state;
      },
      { getState: () => mockState() }
    ),
  };
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import LoginScreen from '@/app/(auth)/login';

jest.spyOn(Alert, 'alert');

beforeEach(() => {
  jest.clearAllMocks();
  mockSignIn = jest.fn();
});

describe('LoginScreen', () => {
  it('renders email and password inputs', async () => {
    await render(<LoginScreen />);
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
  });

  it('renders sign in button', async () => {
    await render(<LoginScreen />);
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('renders create account link', async () => {
    await render(<LoginScreen />);
    expect(screen.getByText("Don't have an account? Create one")).toBeTruthy();
  });

  it('calls signIn with email and password on submit', async () => {
    await render(<LoginScreen />);

    const emailInput = screen.getByPlaceholderText('your@email.com');
    const passwordInput = screen.getByPlaceholderText('Min 6 characters');

    await fireEvent.changeText(emailInput, 'test@example.com');
    await fireEvent.changeText(passwordInput, 'password123');
    await fireEvent.press(screen.getByText('Sign In'));

    expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('shows alert for empty email', async () => {
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByText('Sign In'));

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Email is required');
  });

  it('shows alert for invalid email format', async () => {
    await render(<LoginScreen />);

    const emailInput = screen.getByPlaceholderText('your@email.com');
    await fireEvent.changeText(emailInput, 'not-an-email');
    await fireEvent.press(screen.getByText('Sign In'));

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Invalid email');
  });

  it('shows alert for short password', async () => {
    await render(<LoginScreen />);

    const emailInput = screen.getByPlaceholderText('your@email.com');
    const passwordInput = screen.getByPlaceholderText('Min 6 characters');

    await fireEvent.changeText(emailInput, 'test@example.com');
    await fireEvent.changeText(passwordInput, '12');
    await fireEvent.press(screen.getByText('Sign In'));

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Password must be at least 6 characters');
  });

  it('renders app title Alpha Planner', async () => {
    await render(<LoginScreen />);
    expect(screen.getByText('Alpha Planner')).toBeTruthy();
  });
});
