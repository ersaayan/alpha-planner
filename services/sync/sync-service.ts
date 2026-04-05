import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useSyncStore } from '@/stores/sync-store';
import type { SyncOperation } from '@/types/sync.types';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

// Tables that support sync
const SYNCABLE_TABLES = [
  'categories',
  'todos',
  'subtasks',
  'pomodoro_sessions',
  'achievements',
  'daily_stats',
  'daily_quests',
  'weekly_goals',
] as const;

// Tables with soft delete (have deleted_at column)
const SOFT_DELETE_TABLES = new Set(['categories', 'todos', 'subtasks']);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a single sync operation against Supabase.
 */
async function executeOperation(op: SyncOperation, userId: string): Promise<void> {
  const dataWithUser = { ...op.data, user_id: userId };

  switch (op.type) {
    case 'insert': {
      const { error } = await supabase.from(op.table).upsert(dataWithUser);
      if (error) throw error;
      break;
    }
    case 'update': {
      const { id, ...rest } = dataWithUser;
      const { error } = await supabase
        .from(op.table)
        .update(rest)
        .eq('id', id as string);
      if (error) throw error;
      break;
    }
    case 'delete': {
      if (SOFT_DELETE_TABLES.has(op.table)) {
        // Soft delete: set deleted_at
        const { error } = await supabase
          .from(op.table)
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', op.data.id as string);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(op.table)
          .delete()
          .eq('id', op.data.id as string);
        if (error) throw error;
      }
      break;
    }
  }
}

/**
 * Push all pending operations to Supabase.
 * Uses exponential backoff on failure.
 */
export async function pushPendingOperations(): Promise<{ success: number; failed: number }> {
  const syncStore = useSyncStore.getState();
  const authStore = useAuthStore.getState();
  const userId = authStore.user?.id;

  if (!userId) return { success: 0, failed: 0 };

  const pending = [...syncStore.pendingOperations];
  if (pending.length === 0) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;
  const succeeded: string[] = [];

  for (const op of pending) {
    try {
      await executeOperation(op, userId);
      succeeded.push(op.id);
      success++;
    } catch (error) {
      if (op.retryCount >= MAX_RETRIES - 1) {
        // Max retries reached — drop the operation
        console.warn(`Sync op ${op.id} failed after ${MAX_RETRIES} retries:`, error);
        succeeded.push(op.id); // Remove from queue
        failed++;
      } else {
        // Retry with backoff
        syncStore.incrementRetry(op.id);
        const delayMs = RETRY_DELAYS[op.retryCount] ?? 4000;
        await delay(delayMs);
        // Try once more
        try {
          await executeOperation(op, userId);
          succeeded.push(op.id);
          success++;
        } catch {
          failed++;
        }
      }
    }
  }

  if (succeeded.length > 0) {
    syncStore.dequeueMany(succeeded);
  }

  return { success, failed };
}

/**
 * Pull remote changes since lastSyncedAt.
 * Returns records grouped by table.
 */
export async function pullRemoteChanges(): Promise<Record<string, unknown[]>> {
  const syncStore = useSyncStore.getState();
  const authStore = useAuthStore.getState();
  const userId = authStore.user?.id;

  if (!userId) return {};

  const since = syncStore.lastSyncedAt;
  const result: Record<string, unknown[]> = {};

  for (const table of SYNCABLE_TABLES) {
    try {
      let query = supabase
        .from(table)
        .select('*')
        .eq('user_id', userId);

      if (since) {
        query = query.gt('updated_at', since);
      }

      // For soft-delete tables, include deleted records for sync awareness
      // (RLS handles user isolation, no extra filter needed)

      const { data, error } = await query;
      if (error) {
        console.warn(`Pull failed for ${table}:`, error.message);
        continue;
      }
      if (data && data.length > 0) {
        result[table] = data;
      }
    } catch (error) {
      console.warn(`Pull error for ${table}:`, error);
    }
  }

  // Update lastSyncedAt
  syncStore.setLastSyncedAt(new Date().toISOString());

  return result;
}

/**
 * Merge remote data into local Zustand stores.
 * Uses last-write-wins based on updated_at / created_at timestamps.
 */
export function mergeIntoLocalStores(
  remoteData: Record<string, unknown[]>,
  localStores: {
    todoStore: { todos: Array<{ id: string; updatedAt: string }>; _mergeRemoteTodos: (todos: unknown[]) => void };
    categoryStore: { categories: Array<{ id: string; updatedAt: string }>; _mergeRemoteCategories: (categories: unknown[]) => void };
  }
): void {
  // Merge todos
  if (remoteData.todos) {
    localStores.todoStore._mergeRemoteTodos(remoteData.todos);
  }

  // Merge categories
  if (remoteData.categories) {
    localStores.categoryStore._mergeRemoteCategories(remoteData.categories);
  }

  // Other tables (subtasks, pomodoro_sessions, achievements, daily_stats, etc.)
  // are either immutable records or managed through their respective stores.
  // They will be synced incrementally as stores are updated in later phases.
}

/**
 * Full sync cycle: pull remote → merge → push pending.
 */
export async function fullSync(): Promise<void> {
  const syncStore = useSyncStore.getState();
  const authStore = useAuthStore.getState();

  if (!authStore.session || syncStore.isSyncing) return;

  syncStore.setSyncing(true);
  syncStore.setError(null);

  try {
    // Pull first (get latest server state)
    await pullRemoteChanges();

    // Then push local changes
    const { failed } = await pushPendingOperations();

    if (failed > 0) {
      syncStore.setError(`${failed} operation(s) failed to sync`);
    }
  } catch (error) {
    syncStore.setError((error as Error).message);
  } finally {
    syncStore.setSyncing(false);
  }
}
