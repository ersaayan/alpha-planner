import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useSyncStore } from '@/stores/sync-store';
import type { SyncOperation } from '@/types/sync.types';

/*
 * EXPERIMENTAL. Only runs in builds with Supabase configured and a signed-in user.
 * The engine is push-only for now: pulling and merging remote changes (and conflict
 * resolution) is v1.x work, see docs/ARCHITECTURE.md.
 */

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

/**
 * Execute a single sync operation against Supabase.
 */
async function executeOperation(client: SupabaseClient, op: SyncOperation, userId: string): Promise<void> {
  const dataWithUser = { ...op.data, user_id: userId };

  switch (op.type) {
    case 'insert': {
      const { error } = await client.from(op.table).upsert(dataWithUser);
      if (error) throw error;
      break;
    }
    case 'update': {
      const { id, ...rest } = dataWithUser as Record<string, unknown> & { id: string; user_id: string };
      const { error } = await client
        .from(op.table)
        .update(rest)
        .eq('id', id as string);
      if (error) throw error;
      break;
    }
    case 'delete': {
      if (SOFT_DELETE_TABLES.has(op.table)) {
        // Soft delete: set deleted_at
        const { error } = await client
          .from(op.table)
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', op.data.id as string);
        if (error) throw error;
      } else {
        const { error } = await client
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
 * Push pending operations of the signed-in user to Supabase, oldest first.
 *
 * - Operations queued for another account are discarded, never uploaded.
 * - A failed operation stays in the queue (with its retry count increased) and the
 *   push stops there, so later operations never overtake an earlier one. Nothing is
 *   dropped because of a failure; the next sync retries it.
 */
export async function pushPendingOperations(): Promise<{ success: number; failed: number }> {
  const client = supabase;
  const userId = useAuthStore.getState().user?.id;
  if (!client || !userId) return { success: 0, failed: 0 };

  const foreign = useSyncStore.getState().pendingOperations.filter((op) => op.userId !== userId);
  if (foreign.length > 0) {
    useSyncStore.getState().dequeueMany(foreign.map((op) => op.id));
  }

  const pending = useSyncStore.getState().pendingOperations.filter((op) => op.userId === userId);
  let success = 0;

  for (const op of pending) {
    try {
      await executeOperation(client, op, userId);
    } catch (error) {
      console.warn(`[sync] Operation ${op.id} failed; it stays queued.`, error);
      useSyncStore.getState().incrementRetry(op.id);
      return { success, failed: 1 };
    }
    useSyncStore.getState().dequeue(op.id);
    success++;
    // Stop if the account changed while a request was in flight.
    if (useAuthStore.getState().user?.id !== userId) break;
  }

  return { success, failed: 0 };
}

/**
 * Pull remote changes since lastSyncedAt, grouped by table.
 * Not called by fullSync() yet: nothing merges the result into the local stores, and
 * advancing the cursor without merging would skip those changes for good later.
 */
export async function pullRemoteChanges(): Promise<Record<string, unknown[]>> {
  const client = supabase;
  const userId = useAuthStore.getState().user?.id;
  if (!client || !userId) return {};

  const since = useSyncStore.getState().lastSyncedAt;
  const result: Record<string, unknown[]> = {};

  for (const table of SYNCABLE_TABLES) {
    try {
      let query = client
        .from(table)
        .select('*')
        .eq('user_id', userId);

      if (since) {
        query = query.gt('updated_at', since);
      }

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
 * Sync cycle: push the signed-in user's pending changes.
 */
export async function fullSync(): Promise<void> {
  if (!supabase || useAuthStore.getState().status !== 'signedIn' || useSyncStore.getState().isSyncing) return;

  const syncStore = useSyncStore.getState();
  syncStore.setSyncing(true);
  syncStore.setError(null);

  try {
    const { failed } = await pushPendingOperations();

    if (failed > 0) {
      useSyncStore.getState().setError(`${failed} operation(s) failed to sync`);
    }
  } catch (error) {
    useSyncStore.getState().setError((error as Error).message);
  } finally {
    useSyncStore.getState().setSyncing(false);
  }
}
