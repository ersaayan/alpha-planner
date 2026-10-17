jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

import { Colors } from '@/constants/theme';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SyncStatus } from '@/components/common/sync-status';
import { useSyncStore } from '@/stores/sync-store';

describe('SyncStatus', () => {
  beforeEach(() => {
    useSyncStore.setState({
      isSyncing: false,
      lastError: null,
      pendingOperations: [],
    });
  });

  it('renders nothing when idle (no syncing, no error, no pending)', async () => {
    const { toJSON } = await render(<SyncStatus />);
    expect(toJSON()).toBeNull();
  });

  it('renders activity indicator when syncing', async () => {
    useSyncStore.setState({ isSyncing: true, lastError: null, pendingOperations: [] });
    await render(<SyncStatus />);
    // ActivityIndicator does not have a text node; check the component tree is non-null
    const { toJSON } = await render(<SyncStatus />);
    const tree = toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders error dot when lastError is set', async () => {
    useSyncStore.setState({
      isSyncing: false,
      lastError: 'Network error',
      pendingOperations: [],
    });
    const { toJSON } = await render(<SyncStatus />);
    const tree = toJSON();
    expect(tree).not.toBeNull();
    // The rendered tree should contain a View with the error backgroundColor
    const json = JSON.stringify(tree);
    expect(json).toContain(Colors.light.error);
  });

  it('renders warning dot when pending operations exist', async () => {
    useSyncStore.setState({
      isSyncing: false,
      lastError: null,
      pendingOperations: [
        { id: '1', table: 'todos', type: 'insert', data: {}, createdAt: '', retryCount: 0 },
      ] as any,
    });
    const { toJSON } = await render(<SyncStatus />);
    const tree = toJSON();
    expect(tree).not.toBeNull();
    // The rendered tree should contain a View with the warning backgroundColor
    const json = JSON.stringify(tree);
    expect(json).toContain(Colors.light.warning);
  });
});
