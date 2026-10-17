/**
 * Export and import of everything the user made, as one versioned JSON file. The app is
 * local-first: without sync, this file is the only way to keep data when changing phones.
 *
 * A backup holds each store's persisted state with its store version. Importing replaces
 * the data on this device and runs every store's own migration, so a backup made by an
 * older app version loads like an old install would.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { PersistOptions } from 'zustand/middleware';

import { runStartupTasks } from '@/services/app/startup-tasks';
import { changeLanguage } from '@/services/i18n/i18n-config';
import { whenAlertsSettled } from '@/services/notifications/pomodoro-alerts';
import { useCategoryStore } from '@/stores/category-store';
import { useDailyQuestsStore } from '@/stores/daily-quests-store';
import { useGamificationStore } from '@/stores/gamification-store';
import { usePomodoroStore } from '@/stores/pomodoro-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useTodoStore } from '@/stores/todo-store';
import { useWeeklyGoalsStore } from '@/stores/weekly-goals-store';
import { getDateKey } from '@/utils/date';

export const BACKUP_FORMAT = 'alpha-planner-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  appVersion: string | null;
  /** Storage name → that store's persisted state and its version. */
  stores: Record<string, { version: number; state: Record<string, unknown> }>;
}

export type BackupError = 'unreadable' | 'notBackup' | 'newerVersion' | 'empty';
export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: BackupError };

interface PersistApi {
  persist: { getOptions: () => Partial<PersistOptions<unknown, unknown>> };
}
type BackupStore = UseBoundStore<StoreApi<object>> & PersistApi;

/**
 * Everything the user made. Not included: the sign-in session and the sync queue (they
 * belong to this device), and the running timer (only finished sessions are kept).
 */
const BACKUP_STORES = [
  useSettingsStore,
  useTodoStore,
  useCategoryStore,
  useGamificationStore,
  usePomodoroStore,
  useDailyQuestsStore,
  useWeeklyGoalsStore,
] as unknown as BackupStore[];

function optionsOf(store: BackupStore) {
  return store.persist.getOptions() as PersistOptions<object, Record<string, unknown>>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createBackup(now: Date = new Date()): BackupFile {
  const stores: BackupFile['stores'] = {};
  for (const store of BACKUP_STORES) {
    const options = optionsOf(store);
    if (!options.name || !options.partialize) continue;
    let state = options.partialize(store.getState()) as Record<string, unknown>;
    if (store === (usePomodoroStore as unknown as BackupStore)) state = { sessions: state.sessions ?? [] };
    stores[options.name] = { version: options.version ?? 0, state };
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    appVersion: Constants.expoConfig?.version ?? null,
    stores,
  };
}

/** Checks a file before anything is replaced. */
export function parseBackup(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'unreadable' };
  }
  if (!isPlainObject(data) || data.format !== BACKUP_FORMAT || !isPlainObject(data.stores)) {
    return { ok: false, error: 'notBackup' };
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) return { ok: false, error: 'newerVersion' };

  const stores: BackupFile['stores'] = {};
  for (const store of BACKUP_STORES) {
    const { name, version = 0 } = optionsOf(store);
    if (!name) continue;
    const entry = data.stores[name];
    if (entry === undefined) continue;
    if (!isPlainObject(entry) || typeof entry.version !== 'number' || !isPlainObject(entry.state)) {
      return { ok: false, error: 'notBackup' };
    }
    // Made by a newer app: its data may not be understood here.
    if (entry.version > version) return { ok: false, error: 'newerVersion' };
    stores[name] = { version: entry.version, state: entry.state };
  }
  if (Object.keys(stores).length === 0) return { ok: false, error: 'empty' };

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: data.version,
      exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
      appVersion: typeof data.appVersion === 'string' ? data.appVersion : null,
      stores,
    },
  };
}

/** What a backup contains, for the confirmation before importing it. */
export function describeBackup(backup: BackupFile): { exportedAt: string; todos: number; achievements: number; level: number | null } {
  const todos = backup.stores['todo-storage']?.state.todos;
  const gamification = backup.stores['gamification-storage']?.state;
  const achievements = gamification?.unlockedAchievements;
  const stats = gamification?.stats as { level?: unknown } | undefined;
  return {
    exportedAt: backup.exportedAt,
    todos: Array.isArray(todos) ? todos.length : 0,
    achievements: Array.isArray(achievements) ? achievements.length : 0,
    level: typeof stats?.level === 'number' ? stats.level : null,
  };
}

/**
 * Replaces the data on this device with the backup. Each store's data goes through its
 * own migration (when the backup is older) and merge with defaults, exactly like data
 * loaded from disk; stores missing from the backup return to their first-launch state.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  // Stop the timer through its own API, without crediting anything.
  usePomodoroStore.setState({ sessions: [], currentSession: null });
  usePomodoroStore.getState().resetTimer();
  await whenAlertsSettled();

  for (const store of BACKUP_STORES) {
    const options = optionsOf(store);
    if (!options.name) continue;
    const initial = store.getInitialState();
    const entry = backup.stores[options.name];
    if (!entry) {
      store.setState(initial, true);
      continue;
    }
    let state: unknown = entry.state;
    if (entry.version !== (options.version ?? 0) && options.migrate) {
      state = await options.migrate(state, entry.version);
    }
    const merged = options.merge ? options.merge(state, initial) : { ...initial, ...(state as object) };
    store.setState(merged, true);
  }

  // The timer again, stopped, with the imported settings.
  usePomodoroStore.getState().resetTimer();
  runStartupTasks();
  changeLanguage(useSettingsStore.getState().settings.language);
}

// ── Files ────────────────────────────────────────────────────────────────

export function backupFileName(now: Date = new Date()): string {
  return `alpha-planner-backup-${getDateKey(now)}.json`;
}

/**
 * Writes the backup and opens the share sheet (save to Files, Drive, mail…). On the web
 * the file is downloaded instead.
 */
export async function exportBackup(dialogTitle: string): Promise<void> {
  const json = JSON.stringify(createBackup(), null, 2);
  const name = backupFileName();

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(json);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle });
}

/** Lets the user choose a backup file and checks it. Null when the picker was closed. */
export async function pickBackup(): Promise<ParseResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  try {
    const text = asset.file ? await asset.file.text() : await new File(asset.uri).text();
    return parseBackup(text);
  } catch {
    return { ok: false, error: 'unreadable' };
  }
}
