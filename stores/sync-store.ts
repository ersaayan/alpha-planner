import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SyncOperation } from '@/types/sync.types';
import { generateId } from '@/utils/uuid';

interface SyncStore {
  // State
  pendingOperations: SyncOperation[];
  lastSyncedAt: string | null;
  isSyncing: boolean;
  lastError: string | null;

  // Actions
  enqueue: (table: string, type: SyncOperation['type'], data: Record<string, unknown>) => void;
  dequeue: (opId: string) => void;
  dequeueMany: (opIds: string[]) => void;
  incrementRetry: (opId: string) => void;
  setSyncing: (value: boolean) => void;
  setLastSyncedAt: (iso: string) => void;
  setError: (error: string | null) => void;
  clearQueue: () => void;
  getPendingCount: () => number;
}

export const useSyncStore = create<SyncStore>()(
  persist(
    (set, get) => ({
      pendingOperations: [],
      lastSyncedAt: null,
      isSyncing: false,
      lastError: null,

      enqueue: (table, type, data) => {
        const op: SyncOperation = {
          id: generateId(),
          table,
          type,
          data,
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
      clearQueue: () => set({ pendingOperations: [] }),
      getPendingCount: () => get().pendingOperations.length,
    }),
    {
      name: 'sync-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        pendingOperations: state.pendingOperations,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);
