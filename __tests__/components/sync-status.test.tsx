jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

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

  it('renders nothing when idle (no syncing, no error, no pending)', () => {
    const { toJSON } = render(<SyncStatus />);
    expect(toJSON()).toBeNull();
  });

  it('renders activity indicator when syncing', () => {
    useSyncStore.setState({ isSyncing: true, lastError: null, pendingOperations: [] });
    render(<SyncStatus />);
    // ActivityIndicator does not have a text node; check the component tree is non-null
    const { toJSON } = render(<SyncStatus />);
    const tree = toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders error dot when lastError is set', () => {
    useSyncStore.setState({
      isSyncing: false,
      lastError: 'Network error',
      pendingOperations: [],
    });
    const { toJSON } = render(<SyncStatus />);
    const tree = toJSON();
    expect(tree).not.toBeNull();
    // The rendered tree should contain a View with the error backgroundColor
    // Colors.light.error is '#F44336'
    const json = JSON.stringify(tree);
    expect(json).toContain('#F44336');
  });

  it('renders warning dot when pending operations exist', () => {
    useSyncStore.setState({
      isSyncing: false,
      lastError: null,
      pendingOperations: [
        { id: '1', table: 'todos', type: 'insert', data: {}, createdAt: '', retryCount: 0 },
      ] as any,
    });
    const { toJSON } = render(<SyncStatus />);
    const tree = toJSON();
    expect(tree).not.toBeNull();
    // The rendered tree should contain a View with the warning backgroundColor
    // Colors.light.warning is '#FF9800'
    const json = JSON.stringify(tree);
    expect(json).toContain('#FF9800');
  });
});
