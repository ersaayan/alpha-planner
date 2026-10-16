import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isSyncConfigured } from '@/services/supabase/client';
import type { SyncOperation } from '@/types/sync.types';
import { generateId } from '@/utils/uuid';
import { asRecord, asRecordArray, createPersistOptions } from './persist';

interface SyncStore {
  // State
  pendingOperations: SyncOperation[];
  lastSyncedAt: string | null;
  /** The signed-in user whose changes are queued. `null` = nobody, nothing is queued. */
  ownerId: string | null;
  isSyncing: boolean;
  lastError: string | null;

  // Actions
  /** Queues a change for upload. A no-op unless sync is configured AND a user is signed in. */
  enqueue: (table: string, type: SyncOperation['type'], data: Record<string, unknown>) => void;
  dequeue: (opId: string) => void;
  dequeueMany: (opIds: string[]) => void;
  incrementRetry: (opId: string) => void;
  setSyncing: (value: boolean) => void;
  setLastSyncedAt: (iso: string) => void;
  setError: (error: string | null) => void;
  /**
   * Sets the user whose changes are queued. A different user (or sign-out) clears the
   * queue and the sync cursor, so one account's changes are never uploaded to another.
   */
  setOwner: (userId: string | null) => void;
  /** Drops every queued operation and the sync cursor. */
  clearQueue: () => void;
  getPendingCount: () => number;
}

export const useSyncStore = create<SyncStore>()(
  persist(
    (set, get) => ({
      pendingOperations: [],
      lastSyncedAt: null,
      ownerId: null,
      isSyncing: false,
      lastError: null,

      enqueue: (table, type, data) => {
        if (!isSyncConfigured) return;
        const userId = get().ownerId;
        if (!userId) return;

        const op: SyncOperation = {
          id: generateId(),
          table,
          type,
          data,
          userId,
          createdAt: new Date().toISOString(),
          retryCount: 0,
        };
        set((state) => ({
          pendingOperations: [...state.pendingOperations, op],
        }));
      },

      dequeue: (opId) => {
        set((state) => ({
          pendingOperations: state.pendingOperations.filter((op) => op.id !== opId),
        }));
      },

      dequeueMany: (opIds) => {
        const idSet = new Set(opIds);
        set((state) => ({
          pendingOperations: state.pendingOperations.filter((op) => !idSet.has(op.id)),
        }));
      },

      incrementRetry: (opId) => {
        set((state) => ({
          pendingOperations: state.pendingOperations.map((op) =>
            op.id === opId ? { ...op, retryCount: op.retryCount + 1 } : op
          ),
        }));
      },

      setSyncing: (value) => set({ isSyncing: value }),
      setLastSyncedAt: (iso) => set({ lastSyncedAt: iso }),
      setError: (error) => set({ lastError: error }),

      setOwner: (userId) => {
        if (get().ownerId === userId) return;
        set({ ownerId: userId, pendingOperations: [], lastSyncedAt: null, lastError: null });
      },

      clearQueue: () => set({ pendingOperations: [], lastSyncedAt: null, lastError: null }),
      getPendingCount: () => get().pendingOperations.length,
    }),
    createPersistOptions<SyncStore, Pick<SyncStore, 'pendingOperations' | 'lastSyncedAt' | 'ownerId'>>({
      name: 'sync-store',
      version: 1,
      partialize: (state) => ({
        pendingOperations: state.pendingOperations,
        lastSyncedAt: state.lastSyncedAt,
        ownerId: state.ownerId,
      }),
      migrate: migrateSyncState,
    })
  )
);

/**
 * v0 → v1. v0 queued operations without an owner, even when nobody was signed in,
 * so they cannot be attributed to an account safely: drop them (the local data they
 * describe is untouched) and reset the cursor. v1+ data keeps only owned operations.
 */
export function migrateSyncState(persisted: unknown, fromVersion: number) {
  const state = asRecord(persisted);
  if (fromVersion < 1) {
    return { pendingOperations: [], lastSyncedAt: null, ownerId: null };
  }
  const ownerId = typeof state.ownerId === 'string' ? state.ownerId : null;
  return {
    pendingOperations: asRecordArray(state.pendingOperations).filter(
      (op) => ownerId !== null && op.userId === ownerId
    ),
    lastSyncedAt: typeof state.lastSyncedAt === 'string' ? state.lastSyncedAt : null,
    ownerId,
  };
}
