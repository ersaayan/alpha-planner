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

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
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
  mockSignUp = jest.fn().mockResolvedValue({ needsConfirmation: true, switchedAccount: false });
});

async function fillAndSubmit(name: string, email: string, password: string) {
  await fireEvent.changeText(screen.getByPlaceholderText('Your name'), name);
  await fireEvent.changeText(screen.getByPlaceholderText('your@email.com'), email);
  await fireEvent.changeText(screen.getByPlaceholderText('Min 6 characters'), password);
  const matches = screen.getAllByText('Create Account');
  await fireEvent.press(matches[matches.length - 1]);
}

describe('RegisterScreen', () => {
  it('renders name, email, password inputs', async () => {
    await render(<RegisterScreen />);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
  });

  it('renders Create Account button', async () => {
    await render(<RegisterScreen />);
    // "Create Account" appears as both page heading and button text
    const matches = screen.getAllByText('Create Account');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('renders sign in link', async () => {
    await render(<RegisterScreen />);
    expect(screen.getByText('Already have an account? Sign in')).toBeTruthy();
  });

  it('calls signUp with name, email, password on submit', async () => {
    await render(<RegisterScreen />);

    const nameInput = screen.getByPlaceholderText('Your name');
    const emailInput = screen.getByPlaceholderText('your@email.com');
    const passwordInput = screen.getByPlaceholderText('Min 6 characters');

    await fireEvent.changeText(nameInput, 'John Doe');
    await fireEvent.changeText(emailInput, 'john@example.com');
    await fireEvent.changeText(passwordInput, 'password123');

    // Press the button instance (last "Create Account" text)
    const matches = screen.getAllByText('Create Account');
    await fireEvent.press(matches[matches.length - 1]);

    expect(mockSignUp).toHaveBeenCalledWith('john@example.com', 'password123', 'John Doe');
  });

  it('shows alert for empty name', async () => {
    await render(<RegisterScreen />);

    const matches = screen.getAllByText('Create Account');
    await fireEvent.press(matches[matches.length - 1]);

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Name is required');
  });

  it('shows alert for invalid email', async () => {
    await render(<RegisterScreen />);

    const nameInput = screen.getByPlaceholderText('Your name');
    const emailInput = screen.getByPlaceholderText('your@email.com');

    await fireEvent.changeText(nameInput, 'John Doe');
    await fireEvent.changeText(emailInput, 'bad-email');

    const matches = screen.getAllByText('Create Account');
    await fireEvent.press(matches[matches.length - 1]);

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Invalid email');
  });

  it('shows alert for short password', async () => {
    await render(<RegisterScreen />);

    const nameInput = screen.getByPlaceholderText('Your name');
    const emailInput = screen.getByPlaceholderText('your@email.com');
    const passwordInput = screen.getByPlaceholderText('Min 6 characters');

    await fireEvent.changeText(nameInput, 'John Doe');
    await fireEvent.changeText(emailInput, 'john@example.com');
    await fireEvent.changeText(passwordInput, '12');

    const matches = screen.getAllByText('Create Account');
    await fireEvent.press(matches[matches.length - 1]);

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Password must be at least 6 characters');
  });

  it('trims name and email', async () => {
    await render(<RegisterScreen />);
    await fillAndSubmit('  John  ', ' john@example.com ', 'password123');
    expect(mockSignUp).toHaveBeenCalledWith('john@example.com', 'password123', 'John');
  });

  it('asks to confirm the email, then goes to sign-in', async () => {
    await render(<RegisterScreen />);
    await fillAndSubmit('John', 'john@example.com', 'password123');

    expect(Alert.alert).toHaveBeenCalledWith('Account Created', expect.stringContaining('confirmation'), expect.any(Array));
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    buttons[0].onPress();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('closes the modal when the server signs the new user in right away', async () => {
    mockSignUp.mockResolvedValue({ needsConfirmation: false, switchedAccount: false });
    await render(<RegisterScreen />);
    await fillAndSubmit('John', 'john@example.com', 'password123');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('shows a translated message when the email is taken', async () => {
    mockSignUp.mockRejectedValue(Object.assign(new Error('User already registered'), { code: 'user_already_exists' }));
    await render(<RegisterScreen />);
    await fillAndSubmit('John', 'john@example.com', 'password123');
    expect(Alert.alert).toHaveBeenCalledWith('Sign Up Failed', 'An account with this email already exists.');
  });
});
