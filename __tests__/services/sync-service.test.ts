import type { Session } from '@supabase/supabase-js';
import { fullSync, pushPendingOperations } from '@/services/sync/sync-service';
import { useAuthStore } from '@/stores/auth-store';
import { useSyncStore } from '@/stores/sync-store';
import type { SyncOperation } from '@/types';
import { setSyncConfigured } from '../helpers/sync';

function session(id: string): Session {
  return { access_token: 'at', refresh_token: 'rt', user: { id, email: `${id}@x.com` } } as unknown as Session;
}

function op(id: string, userId: string): SyncOperation {
  return { id, table: 'todos', type: 'insert', data: { id }, userId, createdAt: '', retryCount: 0 };
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  useAuthStore.setState(useAuthStore.getInitialState(), true);
  useSyncStore.setState(useSyncStore.getInitialState(), true);
});

afterEach(() => {
  jest.restoreAllMocks();
  setSyncConfigured(false);
});

describe('sync service', () => {
  it('does nothing when sync is not configured', async () => {
    useSyncStore.setState({ ownerId: 'a', pendingOperations: [op('1', 'a')] });
    useAuthStore.setState({ status: 'signedIn', user: { id: 'a' } });

    await fullSync();

    expect(useSyncStore.getState().pendingOperations).toHaveLength(1);
  });

  it('uploads only the signed-in user\'s operations and discards other accounts\' ones', async () => {
    const client = setSyncConfigured(true)!;
    useAuthStore.getState().handleSession(session('b'));
    useSyncStore.setState({ pendingOperations: [op('from-a', 'a'), op('from-b', 'b')] });

    const result = await pushPendingOperations();

    expect(result).toEqual({ success: 1, failed: 0 });
    expect(client.query.upsert).toHaveBeenCalledTimes(1);
    expect(client.query.upsert).toHaveBeenCalledWith({ id: 'from-b', user_id: 'b' });
    expect(useSyncStore.getState().pendingOperations).toEqual([]);
  });

  it('keeps a failed operation (and everything after it) queued', async () => {
    const client = setSyncConfigured(true)!;
    useAuthStore.getState().handleSession(session('a'));
    useSyncStore.setState({ pendingOperations: [op('1', 'a'), op('2', 'a'), op('3', 'a')] });
    client.query.upsert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'offline' } });

    await fullSync();

    const queue = useSyncStore.getState().pendingOperations;
    expect(queue.map((o) => o.id)).toEqual(['2', '3']);
    expect(queue[0].retryCount).toBe(1);
    expect(useSyncStore.getState().lastError).toBeTruthy();
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });

  it('does not run while signed out', async () => {
    const client = setSyncConfigured(true)!;
    useSyncStore.setState({ ownerId: 'a', pendingOperations: [op('1', 'a')] });

    await fullSync();

    expect(client.from).not.toHaveBeenCalled();
    expect(useSyncStore.getState().pendingOperations).toHaveLength(1);
  });
});
