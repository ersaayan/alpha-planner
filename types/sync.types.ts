export interface SyncOperation {
  id: string;
  table: string;
  type: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

export interface SyncState {
  lastSyncedAt: string | null;
  pendingOperations: SyncOperation[];
  isSyncing: boolean;
  lastError: string | null;
}
