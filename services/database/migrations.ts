import type { SQLiteDatabase } from 'expo-sqlite';
import { DEFAULT_CATEGORIES } from '@/types';
import { generateId } from '@/utils/uuid';

const DATABASE_VERSION = 1;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      -- Categories table
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT,
        is_default INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Todos table
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        priority TEXT NOT NULL DEFAULT 'medium',
        pomodoro_sessions INTEGER NOT NULL DEFAULT 0,
        estimated_pomodoros INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      );

      -- Subtasks table
      CREATE TABLE IF NOT EXISTS subtasks (
        id TEXT PRIMARY KEY NOT NULL,
        todo_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        is_completed INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Pomodoro sessions table
      CREATE TABLE IF NOT EXISTS pomodoro_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        todo_id TEXT REFERENCES todos(id) ON DELETE SET NULL,
        phase TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        paused_duration INTEGER NOT NULL DEFAULT 0,
        was_completed INTEGER NOT NULL DEFAULT 0,
        duration INTEGER NOT NULL,
        target_duration INTEGER NOT NULL
      );

      -- User achievements table
      CREATE TABLE IF NOT EXISTS user_achievements (
        achievement_id TEXT PRIMARY KEY NOT NULL,
        unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
        notified INTEGER NOT NULL DEFAULT 0
      );

      -- User stats table (single row)
      CREATE TABLE IF NOT EXISTS user_stats (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        total_pomodoros INTEGER NOT NULL DEFAULT 0,
        total_focus_time INTEGER NOT NULL DEFAULT 0,
        total_tasks_completed INTEGER NOT NULL DEFAULT 0,
        current_streak INTEGER NOT NULL DEFAULT 0,
        longest_streak INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        current_xp INTEGER NOT NULL DEFAULT 0,
        total_xp INTEGER NOT NULL DEFAULT 0,
        last_active_date TEXT NOT NULL DEFAULT (date('now'))
      );

      -- Daily stats for charts
      CREATE TABLE IF NOT EXISTS daily_stats (
        date TEXT PRIMARY KEY NOT NULL,
        pomodoros_completed INTEGER NOT NULL DEFAULT 0,
        focus_time INTEGER NOT NULL DEFAULT 0,
        tasks_completed INTEGER NOT NULL DEFAULT 0
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
      CREATE INDEX IF NOT EXISTS idx_todos_category ON todos(category_id);
      CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
      CREATE INDEX IF NOT EXISTS idx_subtasks_todo ON subtasks(todo_id);
      CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_todo ON pomodoro_sessions(todo_id);
      CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

      -- Insert initial user stats row
      INSERT OR IGNORE INTO user_stats (id) VALUES (1);
    `);

    // Insert default categories only if none exist
    const existingCategories = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
    if (existingCategories?.count === 0) {
      for (const category of DEFAULT_CATEGORIES) {
        await db.runAsync(
          `INSERT INTO categories (id, name, color, icon, is_default, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [generateId(), category.name, category.color, category.icon, category.isDefault ? 1 : 0, category.order]
        );
      }
    }

    currentVersion = 1;
  }

  // Future migrations would go here
  // if (currentVersion === 1) { ... currentVersion = 2; }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
