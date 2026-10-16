export interface SyncOperation {
  id: string;
  table: string;
  type: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  /** The account this change belongs to; it is only ever uploaded for that account. */
  userId: string;
  createdAt: string;
  retryCount: number;
}

export interface SyncState {
  lastSyncedAt: string | null;
  pendingOperations: SyncOperation[];
  ownerId: string | null;
  isSyncing: boolean;
  lastError: string | null;
}
