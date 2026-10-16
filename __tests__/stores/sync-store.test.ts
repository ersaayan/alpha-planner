import { migrateSyncState, useSyncStore } from '@/stores/sync-store';
import { setSyncConfigured } from '../helpers/sync';

const INITIAL_STATE = {
  pendingOperations: [],
  lastSyncedAt: null,
  ownerId: 'user-1',
  isSyncing: false,
  lastError: null,
};

beforeAll(() => {
  setSyncConfigured(true);
});

afterAll(() => {
  setSyncConfigured(false);
});

beforeEach(() => {
  setSyncConfigured(true);
  useSyncStore.setState(INITIAL_STATE);
});

describe('useSyncStore: inert unless configured and signed in', () => {
  it('enqueue is a no-op when sync is not configured (store builds)', () => {
    setSyncConfigured(false);
    useSyncStore.getState().enqueue('todos', 'insert', { id: '1' });
    expect(useSyncStore.getState().pendingOperations).toEqual([]);
  });

  it('enqueue is a no-op when nobody is signed in', () => {
    useSyncStore.setState({ ownerId: null });
    useSyncStore.getState().enqueue('todos', 'insert', { id: '1' });
    expect(useSyncStore.getState().pendingOperations).toEqual([]);
  });

  it('enqueue tags each operation with its owner', () => {
    useSyncStore.getState().enqueue('todos', 'insert', { id: '1' });
    expect(useSyncStore.getState().pendingOperations[0].userId).toBe('user-1');
  });

  it('setOwner to another user clears the queue and cursor', () => {
    useSyncStore.getState().enqueue('todos', 'insert', { id: '1' });
    useSyncStore.getState().setLastSyncedAt('2026-10-01T00:00:00.000Z');

    useSyncStore.getState().setOwner('user-2');

    const state = useSyncStore.getState();
    expect(state.ownerId).toBe('user-2');
    expect(state.pendingOperations).toEqual([]);
    expect(state.lastSyncedAt).toBeNull();
  });

  it('setOwner with the same user keeps the queue', () => {
    useSyncStore.getState().enqueue('todos', 'insert', { id: '1' });
    useSyncStore.getState().setOwner('user-1');
    expect(useSyncStore.getState().pendingOperations).toHaveLength(1);
  });

  it('setOwner(null) (sign-out) clears the queue', () => {
    useSyncStore.getState().enqueue('todos', 'insert', { id: '1' });
    useSyncStore.getState().setOwner(null);
    expect(useSyncStore.getState().pendingOperations).toEqual([]);
    expect(useSyncStore.getState().ownerId).toBeNull();
  });
});

describe('migrateSyncState', () => {
  it('v0 → v1 drops ownerless operations and resets the cursor', () => {
    const v0 = {
      pendingOperations: [{ id: 'op1', table: 'todos', type: 'insert', data: {}, createdAt: '', retryCount: 0 }],
      lastSyncedAt: '2026-10-01T00:00:00.000Z',
    };
    expect(migrateSyncState(v0, 0)).toEqual({ pendingOperations: [], lastSyncedAt: null, ownerId: null });
  });

  it('keeps only operations owned by the stored owner', () => {
    const v1 = {
      ownerId: 'a',
      lastSyncedAt: null,
      pendingOperations: [
        { id: 'op1', userId: 'a' },
        { id: 'op2', userId: 'b' },
      ],
    };
    expect(migrateSyncState(v1, 1).pendingOperations).toEqual([{ id: 'op1', userId: 'a' }]);
  });

  it('tolerates garbage', () => {
    expect(migrateSyncState('nope', 0)).toEqual({ pendingOperations: [], lastSyncedAt: null, ownerId: null });
    expect(migrateSyncState(undefined, 1)).toEqual({ pendingOperations: [], lastSyncedAt: null, ownerId: null });
  });
});

describe('useSyncStore', () => {
  // ── enqueue ──────────────────────────────────────────────────────────

  it('enqueue: adds an operation to the queue with correct fields', () => {
    const { enqueue } = useSyncStore.getState();

    enqueue('todos', 'insert', { title: 'Buy milk' });

    const { pendingOperations } = useSyncStore.getState();
    expect(pendingOperations).toHaveLength(1);

    const op = pendingOperations[0];
    expect(op.table).toBe('todos');
    expect(op.type).toBe('insert');
    expect(op.data).toEqual({ title: 'Buy milk' });
    expect(op.retryCount).toBe(0);
    expect(op.id).toBeDefined();
    expect(op.createdAt).toBeDefined();
  });

  it('enqueue: appends multiple operations preserving order', () => {
    const { enqueue } = useSyncStore.getState();

    enqueue('todos', 'insert', { id: '1' });
    enqueue('todos', 'update', { id: '2' });
    enqueue('categories', 'delete', { id: '3' });

    const { pendingOperations } = useSyncStore.getState();
    expect(pendingOperations).toHaveLength(3);
    expect(pendingOperations[0].type).toBe('insert');
    expect(pendingOperations[1].type).toBe('update');
    expect(pendingOperations[2].table).toBe('categories');
  });

  // ── dequeue ──────────────────────────────────────────────────────────

  it('dequeue: removes a single operation by id', () => {
    useSyncStore.getState().enqueue('todos', 'insert', { id: '1' });
    useSyncStore.getState().enqueue('todos', 'update', { id: '2' });

    const ops = useSyncStore.getState().pendingOperations;
    useSyncStore.getState().dequeue(ops[0].id);

    const remaining = useSyncStore.getState().pendingOperations;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe('update');
  });

  it('dequeue: is a no-op when id does not exist', () => {
    useSyncStore.getState().enqueue('todos', 'insert', { id: '1' });
    useSyncStore.getState().dequeue('nonexistent-id');

    expect(useSyncStore.getState().pendingOperations).toHaveLength(1);
  });

  // ── dequeueMany ──────────────────────────────────────────────────────

  it('dequeueMany: removes multiple operations by ids', () => {
    useSyncStore.getState().enqueue('a', 'insert', {});
    useSyncStore.getState().enqueue('b', 'update', {});
    useSyncStore.getState().enqueue('c', 'delete', {});

    const ops = useSyncStore.getState().pendingOperations;
    useSyncStore.getState().dequeueMany([ops[0].id, ops[2].id]);

    const remaining = useSyncStore.getState().pendingOperations;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].table).toBe('b');
  });

  // ── incrementRetry ───────────────────────────────────────────────────

  it('incrementRetry: increments retryCount for the given operation', () => {
    useSyncStore.getState().enqueue('todos', 'insert', {});

    const opId = useSyncStore.getState().pendingOperations[0].id;
    useSyncStore.getState().incrementRetry(opId);
    useSyncStore.getState().incrementRetry(opId);

    const op = useSyncStore.getState().pendingOperations[0];
    expect(op.retryCount).toBe(2);
  });

  it('incrementRetry: does not affect other operations', () => {
    useSyncStore.getState().enqueue('a', 'insert', {});
    useSyncStore.getState().enqueue('b', 'update', {});

    const ops = useSyncStore.getState().pendingOperations;
    useSyncStore.getState().incrementRetry(ops[0].id);

    const updated = useSyncStore.getState().pendingOperations;
    expect(updated[0].retryCount).toBe(1);
    expect(updated[1].retryCount).toBe(0);
  });

  // ── setSyncing ───────────────────────────────────────────────────────

  it('setSyncing: sets isSyncing to true', () => {
    useSyncStore.getState().setSyncing(true);
    expect(useSyncStore.getState().isSyncing).toBe(true);
  });

  it('setSyncing: sets isSyncing back to false', () => {
    useSyncStore.getState().setSyncing(true);
    useSyncStore.getState().setSyncing(false);
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });

  // ── setError ─────────────────────────────────────────────────────────

  it('setError: stores error message', () => {
    useSyncStore.getState().setError('Network failure');
    expect(useSyncStore.getState().lastError).toBe('Network failure');
  });

  it('setError: clears error when null is passed', () => {
    useSyncStore.getState().setError('Some error');
    useSyncStore.getState().setError(null);
    expect(useSyncStore.getState().lastError).toBeNull();
  });

  // ── setLastSyncedAt ──────────────────────────────────────────────────

  it('setLastSyncedAt: updates the timestamp', () => {
    const iso = '2026-04-05T10:00:00.000Z';
    useSyncStore.getState().setLastSyncedAt(iso);
    expect(useSyncStore.getState().lastSyncedAt).toBe(iso);
  });

  // ── clearQueue ───────────────────────────────────────────────────────

  it('clearQueue: empties the pending operations', () => {
    useSyncStore.getState().enqueue('a', 'insert', {});
    useSyncStore.getState().enqueue('b', 'update', {});
    expect(useSyncStore.getState().pendingOperations).toHaveLength(2);

    useSyncStore.getState().clearQueue();
    expect(useSyncStore.getState().pendingOperations).toHaveLength(0);
  });

  // ── getPendingCount ──────────────────────────────────────────────────

  it('getPendingCount: returns 0 for empty queue', () => {
    expect(useSyncStore.getState().getPendingCount()).toBe(0);
  });

  it('getPendingCount: returns correct count after enqueue operations', () => {
    useSyncStore.getState().enqueue('a', 'insert', {});
    useSyncStore.getState().enqueue('b', 'update', {});
    useSyncStore.getState().enqueue('c', 'delete', {});

    expect(useSyncStore.getState().getPendingCount()).toBe(3);
  });

  it('getPendingCount: reflects dequeue changes', () => {
    useSyncStore.getState().enqueue('a', 'insert', {});
    useSyncStore.getState().enqueue('b', 'update', {});

    const opId = useSyncStore.getState().pendingOperations[0].id;
    useSyncStore.getState().dequeue(opId);

    expect(useSyncStore.getState().getPendingCount()).toBe(1);
  });
});
