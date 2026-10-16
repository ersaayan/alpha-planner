jest.mock('@ui-kitten/components', () => {
  const { Text, View, Pressable } = require('react-native');
  return {
    Text: (props: any) => <Text {...props}>{props.children}</Text>,
    Button: ({ children, onPress, disabled }: any) => (
      <Pressable onPress={onPress} disabled={disabled}>
        <Text>{children}</Text>
      </Pressable>
    ),
    Card: ({ children }: any) => <View>{children}</View>,
    Divider: () => <View />,
  };
});
jest.mock('@/components/icon', () => ({ Icon: () => null }));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }) }));

jest.mock('@/stores/reset-all-data', () => ({ resetAllData: jest.fn().mockResolvedValue(undefined) }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AccountSection } from '@/components/settings/account-section';
import { useAuthStore } from '@/stores/auth-store';
import { resetAllData } from '@/stores/reset-all-data';
import { useSyncStore } from '@/stores/sync-store';
import { setSyncConfigured } from '../helpers/sync';

type AlertButton = { text: string; style?: string; onPress?: () => unknown };

function pressAlertButton(text: string) {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const buttons: AlertButton[] = calls[calls.length - 1][2];
  return buttons.find((button) => button.text === text)!.onPress!();
}

const signOut = jest.fn().mockResolvedValue(undefined);
const deleteAccount = jest.fn().mockResolvedValue(undefined);

function signIn() {
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'me@example.com' }, profile: null, signOut, deleteAccount });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  setSyncConfigured(true);
  useAuthStore.setState({ ...useAuthStore.getInitialState(), status: 'signedOut' }, true);
  useSyncStore.setState(useSyncStore.getInitialState(), true);
});

afterEach(() => {
  setSyncConfigured(false);
});

describe('AccountSection', () => {
  it('renders nothing when sync is not configured', async () => {
    setSyncConfigured(false);
    await render(<AccountSection />);
    expect(screen.toJSON()).toBeNull();
  });

  it('offers an optional sign-in when signed out', async () => {
    await render(<AccountSection />);
    expect(screen.getByText('Sync (experimental)')).toBeTruthy();
    await fireEvent.press(screen.getByText('Sign in to sync'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
  });

  it('shows the account and pending changes when signed in', async () => {
    signIn();
    useSyncStore.setState({ pendingOperations: [{ id: 'op', userId: 'u1' } as never] });
    await render(<AccountSection />);
    expect(screen.getByText('Signed in as me@example.com')).toBeTruthy();
    expect(screen.getByText('Changes waiting to sync: 1')).toBeTruthy();
  });

  it('sign-out asks whether to keep the local data', async () => {
    signIn();
    await render(<AccountSection />);
    await fireEvent.press(screen.getByText('Sign Out'));

    pressAlertButton('Sign out, keep data');
    expect(signOut).toHaveBeenCalled();
    expect(resetAllData).not.toHaveBeenCalled();

    pressAlertButton('Sign out and erase data');
    expect(resetAllData).toHaveBeenCalled();
  });

  it('sign-out warns about changes that were not synced yet', async () => {
    signIn();
    useSyncStore.setState({ pendingOperations: [{ id: 'a' } as never, { id: 'b' } as never] });
    await render(<AccountSection />);
    await fireEvent.press(screen.getByText('Sign Out'));
    expect((Alert.alert as jest.Mock).mock.calls[0][1]).toContain('(2)');
  });

  it('delete account: confirms, deletes on the server, then erases local data', async () => {
    signIn();
    await render(<AccountSection />);
    await fireEvent.press(screen.getByText('Delete account'));
    expect((Alert.alert as jest.Mock).mock.calls[0][0]).toBe('Delete account?');

    await pressAlertButton('Delete account');

    expect(deleteAccount).toHaveBeenCalled();
    expect(resetAllData).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenLastCalledWith('Your account has been deleted.');
  });

  it('delete account failure keeps the local data and explains why', async () => {
    deleteAccount.mockRejectedValueOnce(Object.assign(new Error('Network request failed'), { status: 0 }));
    signIn();
    await render(<AccountSection />);
    await fireEvent.press(screen.getByText('Delete account'));

    await pressAlertButton('Delete account');

    expect(resetAllData).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'The account could not be deleted.',
      'Network error. Please check your connection.'
    );
  });
});
