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

let mockSignUp = jest.fn();

const mockState = () => ({
  signUp: mockSignUp,
  signIn: jest.fn(),
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
import RegisterScreen from '@/app/(auth)/register';

jest.spyOn(Alert, 'alert');

beforeEach(() => {
  jest.clearAllMocks();
  mockSignUp = jest.fn();
});

describe('RegisterScreen', () => {
  it('renders name, email, password inputs', () => {
    render(<RegisterScreen />);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
  });

  it('renders Create Account button', () => {
    render(<RegisterScreen />);
    // "Create Account" appears as both page heading and button text
    const matches = screen.getAllByText('Create Account');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('renders sign in link', () => {
    render(<RegisterScreen />);
    expect(screen.getByText('Already have an account? Sign in')).toBeTruthy();
  });

  it('calls signUp with name, email, password on submit', () => {
    render(<RegisterScreen />);

    const nameInput = screen.getByPlaceholderText('Your name');
    const emailInput = screen.getByPlaceholderText('your@email.com');
    const passwordInput = screen.getByPlaceholderText('Min 6 characters');

    fireEvent.changeText(nameInput, 'John Doe');
    fireEvent.changeText(emailInput, 'john@example.com');
    fireEvent.changeText(passwordInput, 'password123');

    // Press the button instance (last "Create Account" text)
    const matches = screen.getAllByText('Create Account');
    fireEvent.press(matches[matches.length - 1]);

    expect(mockSignUp).toHaveBeenCalledWith('john@example.com', 'password123', 'John Doe');
  });

  it('shows alert for empty name', () => {
    render(<RegisterScreen />);

    const matches = screen.getAllByText('Create Account');
    fireEvent.press(matches[matches.length - 1]);

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Name is required');
  });

  it('shows alert for invalid email', () => {
    render(<RegisterScreen />);

    const nameInput = screen.getByPlaceholderText('Your name');
    const emailInput = screen.getByPlaceholderText('your@email.com');

    fireEvent.changeText(nameInput, 'John Doe');
    fireEvent.changeText(emailInput, 'bad-email');

    const matches = screen.getAllByText('Create Account');
    fireEvent.press(matches[matches.length - 1]);

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Invalid email');
  });

  it('shows alert for short password', () => {
    render(<RegisterScreen />);

    const nameInput = screen.getByPlaceholderText('Your name');
    const emailInput = screen.getByPlaceholderText('your@email.com');
    const passwordInput = screen.getByPlaceholderText('Min 6 characters');

    fireEvent.changeText(nameInput, 'John Doe');
    fireEvent.changeText(emailInput, 'john@example.com');
    fireEvent.changeText(passwordInput, '12');

    const matches = screen.getAllByText('Create Account');
    fireEvent.press(matches[matches.length - 1]);

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Password must be at least 6 characters');
  });
});
