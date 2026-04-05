# Alpha Planner Full Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Alpha Planner into a full-featured Pomodoro + Task Management + RPG Gamification app with Supabase backend, offline-first sync, 50-level progression, 81 achievements, daily quests, weekly goals, combo system, seasonal prestige, i18n, and comprehensive test coverage.

**Architecture:** Offline-first Zustand + AsyncStorage for local state, Supabase for cloud persistence via sync queue. Client-side lazy generation for quests/goals/prestige. Combo multipliers applied at XP award time. moddatetime triggers for server-side `updated_at`. RLS with `(SELECT auth.uid())` caching.

**Tech Stack:** React Native 0.81, Expo SDK 54, TypeScript (strict), Zustand, Supabase (Postgres 17), i18next, Jest + React Native Testing Library, React Native Reanimated 3, UI Kitten

**Spec:** `docs/superpowers/specs/2026-04-05-full-overhaul-design.md`

**Supabase Project ID:** `hcrkeuxzgkdllvqqjwce`

---

## Phase Overview

| Phase | Name | Tasks | Estimated Hours |
|-------|------|-------|-----------------|
| 0 | Foundation — Types, Constants, Bug Fixes | 6 | 6-8h |
| 1 | Auth & Supabase Setup | 6 | 10-12h |
| 2 | Sync Engine | 7 | 12-14h |
| 3 | Pomodoro Timer Refactor | 6 | 10-12h |
| 4 | Gamification V1 — Levels & Achievements | 7 | 14-16h |
| 5 | Advanced Gamification — Quests, Combo, Prestige | 8 | 16-20h |
| 6 | UX — Daily Summary, Component Extraction | 7 | 12-14h |
| 7 | i18n — TR/EN Internationalization | 6 | 10-12h |
| 8 | Test Infrastructure & Polish | 7 | 14-16h |

**Critical Path:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

---

## Phase 0: Foundation — Types, Constants, Bug Fixes

### Task 0.1: Expand Type Definitions

**Files:**
- Modify: `types/gamification.types.ts`
- Modify: `types/pomodoro.types.ts`
- Create: `types/sync.types.ts`
- Create: `types/auth.types.ts`
- Modify: `types/settings.types.ts`
- Modify: `types/index.ts`

- [ ] **Step 1: Add combo, prestige, quest, goal types to gamification.types.ts**

```typescript
// types/gamification.types.ts — ADD to existing file

export interface ComboState {
  sessionCombo: number;
  dailyComboStreak: number;
  lastDailyComboDate: string | null;
}

export interface PrestigeRecord {
  month: string;
  finalLevel: number;
  totalXp: number;
  rewards: string[];
}

export interface PrestigeState {
  count: number;
  currentSeasonStart: string;
  history: PrestigeRecord[];
}

export interface DailyQuest {
  id: string;
  date: string;
  questType: string;
  questParams: Record<string, unknown>;
  targetValue: number;
  currentValue: number;
  isCompleted: boolean;
  xpReward: number;
}

export interface WeeklyGoal {
  id: string;
  weekStart: string;
  goalType: 'system' | 'personal';
  goalParams: Record<string, unknown>;
  targetValue: number;
  currentValue: number;
  isCompleted: boolean;
  xpReward: number;
}

export const INITIAL_COMBO_STATE: ComboState = {
  sessionCombo: 0,
  dailyComboStreak: 0,
  lastDailyComboDate: null,
};

export const INITIAL_PRESTIGE_STATE: PrestigeState = {
  count: 0,
  currentSeasonStart: new Date().toISOString().slice(0, 7),
  history: [],
};
```

- [ ] **Step 2: Create sync types**

```typescript
// types/sync.types.ts — NEW FILE

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
```

- [ ] **Step 3: Create auth types**

```typescript
// types/auth.types.ts — NEW FILE

import { Session, User as SupabaseUser } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  prestigeCount: number;
  createdAt: string;
}

export interface AuthState {
  user: SupabaseUser | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;
}
```

- [ ] **Step 4: Add language field to AppSettings**

In `types/settings.types.ts`, add `language: 'tr' | 'en' | 'system'` to `AppSettings` interface and update `DEFAULT_APP_SETTINGS`.

- [ ] **Step 5: Update barrel exports in types/index.ts**

Add exports for new type files:
```typescript
export * from './sync.types';
export * from './auth.types';
```

- [ ] **Step 6: Commit**

```bash
git add types/
git commit -m "feat: expand type definitions for sync, auth, combo, prestige, quests"
```

---

### Task 0.2: Expand Gamification Constants — 50 Levels

**Files:**
- Modify: `constants/gamification.ts`

- [ ] **Step 1: Replace LEVELS array with 50-level exponential system**

Replace the existing 10-item `LEVELS` array with a generated 50-level array using the formula `xpRequired(level) = Math.floor(50 * Math.pow(level, 1.8))`.

5 tiers with nature-themed names:
- Seedling (1-10): "Seed", "Sprout", "Tiny Bud", "Green Shoot", "Young Leaf", "Tender Stem", "Growing Root", "First Bloom", "Small Vine", "Seedling Crown"
- Sapling (11-20): "Sapling Start", "Bark Former", "Branch Maker", ... 
- Tree (21-30): "Sturdy Trunk", "Leafy Canopy", ...
- Forest (31-40): "Forest Edge", "Deep Woods", ...
- Ancient (41-50): "Elder Oak", "Ancient Root", ..., "Forest Master"

Update `calculateLevel()` to use binary search over 50 levels.

- [ ] **Step 2: Update XP_VALUES**

```typescript
export const XP_VALUES = {
  POMODORO_COMPLETE: 15,     // was 25
  TASK_COMPLETE: 8,          // was 10
  SUBTASK_COMPLETE: 2,       // was 3
  DAILY_STREAK: 30,          // was 50
  ACHIEVEMENT_BASE: 100,     // unchanged
  DAILY_QUEST_COMPLETE: 20,  // NEW
  DAILY_QUEST_ALL_BONUS: 30, // NEW
  WEEKLY_GOAL_COMPLETE: 100, // NEW
  WEEKLY_GOAL_ALL_BONUS: 100,// NEW
  PERSONAL_GOAL_COMPLETE: 150,// NEW
};
```

- [ ] **Step 3: Commit**

```bash
git add constants/gamification.ts
git commit -m "feat: 50-level exponential system, updated XP values"
```

---

### Task 0.3: Define 81 Achievements

**Files:**
- Modify: `constants/gamification.ts`

- [ ] **Step 1: Define all 81 achievements with 9 categories**

Add the full `ACHIEVEMENTS` array with each achievement having: `id`, `name`, `description`, `icon`, `category`, `xpReward`, `rarity`, `isSecret`, and `requirement` object.

Categories and counts:
- `pomodoro` (12): First Focus through Session Combo x10
- `tasks` (9): Task Starter through Clean Slate
- `streaks` (10): 3 Day Streak through Unbreakable
- `focus_time` (8): First Hour through Night Shift
- `combo` (8): Combo Starter through Double Trouble
- `daily_quest` (8): Quest Beginner through Last Minute
- `category` (6): Category Explorer through Color Collector
- `milestones` (8): First Day through XP Hoarder
- `special` (12): Early Bird through Zen Master

Each achievement's `requirement` has a `type` and `value`:
```typescript
interface AchievementRequirement {
  type: 'pomodoro_count' | 'task_count' | 'streak_days' | 'focus_hours' |
        'session_combo' | 'daily_combo' | 'quest_perfect_days' | 'category_count' |
        'prestige_count' | 'level' | 'total_xp' | 'days_used' |
        'daily_pomodoros' | 'daily_focus_hours' | 'time_of_day' | 'subtask_count' |
        'urgent_task_count' | 'category_tasks' | 'weekly_quest_and_goal' |
        'break_streak';
  value: number;
  extra?: Record<string, unknown>;
}
```

Rarity assignment: Common (25-50 XP), Rare (75-150 XP), Epic (200-500 XP), Legendary (750-1500 XP).

- [ ] **Step 2: Add helper functions**

```typescript
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category);
}

export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}
```

- [ ] **Step 3: Commit**

```bash
git add constants/gamification.ts
git commit -m "feat: define 81 achievements across 9 categories"
```

---

### Task 0.4: Add Daily Quest Templates and Combo Constants

**Files:**
- Create: `constants/daily-quests.ts`
- Create: `constants/combo.ts`
- Create: `constants/weekly-goals.ts`

- [ ] **Step 1: Create daily quest templates**

```typescript
// constants/daily-quests.ts — NEW FILE

export interface QuestTemplate {
  type: string;
  nameKey: string;        // i18n key
  descriptionKey: string; // i18n key with {{value}} placeholder
  minValue: number;
  maxValue: number;
  baseXp: number;
}

export const QUEST_TEMPLATES: QuestTemplate[] = [
  { type: 'complete_pomodoros', nameKey: 'quests.complete_pomodoros', descriptionKey: 'quests.complete_pomodoros_desc', minValue: 2, maxValue: 6, baseXp: 20 },
  { type: 'complete_tasks', nameKey: 'quests.complete_tasks', descriptionKey: 'quests.complete_tasks_desc', minValue: 1, maxValue: 5, baseXp: 20 },
  { type: 'complete_subtasks', nameKey: 'quests.complete_subtasks', descriptionKey: 'quests.complete_subtasks_desc', minValue: 2, maxValue: 8, baseXp: 20 },
  { type: 'focus_time', nameKey: 'quests.focus_time', descriptionKey: 'quests.focus_time_desc', minValue: 30, maxValue: 120, baseXp: 20 },
  { type: 'complete_urgent_task', nameKey: 'quests.complete_urgent', descriptionKey: 'quests.complete_urgent_desc', minValue: 1, maxValue: 2, baseXp: 20 },
  { type: 'complete_high_priority', nameKey: 'quests.complete_high', descriptionKey: 'quests.complete_high_desc', minValue: 1, maxValue: 3, baseXp: 20 },
  { type: 'uninterrupted_focus', nameKey: 'quests.uninterrupted', descriptionKey: 'quests.uninterrupted_desc', minValue: 25, maxValue: 60, baseXp: 20 },
  { type: 'complete_in_category', nameKey: 'quests.in_category', descriptionKey: 'quests.in_category_desc', minValue: 1, maxValue: 3, baseXp: 20 },
  { type: 'create_tasks', nameKey: 'quests.create_tasks', descriptionKey: 'quests.create_tasks_desc', minValue: 2, maxValue: 5, baseXp: 20 },
  { type: 'complete_before_noon', nameKey: 'quests.before_noon', descriptionKey: 'quests.before_noon_desc', minValue: 1, maxValue: 3, baseXp: 20 },
  { type: 'no_skip_break', nameKey: 'quests.no_skip_break', descriptionKey: 'quests.no_skip_break_desc', minValue: 3, maxValue: 5, baseXp: 20 },
  { type: 'start_early', nameKey: 'quests.start_early', descriptionKey: 'quests.start_early_desc', minValue: 7, maxValue: 9, baseXp: 20 },
  { type: 'evening_session', nameKey: 'quests.evening_session', descriptionKey: 'quests.evening_session_desc', minValue: 1, maxValue: 2, baseXp: 20 },
  { type: 'clear_overdue', nameKey: 'quests.clear_overdue', descriptionKey: 'quests.clear_overdue_desc', minValue: 1, maxValue: 3, baseXp: 20 },
  { type: 'long_focus', nameKey: 'quests.long_focus', descriptionKey: 'quests.long_focus_desc', minValue: 45, maxValue: 60, baseXp: 20 },
];

export const DAILY_QUEST_COUNT = 3;
export const DAILY_QUEST_ALL_COMPLETE_BONUS = 30;
```

- [ ] **Step 2: Create combo constants**

```typescript
// constants/combo.ts — NEW FILE

export const SESSION_COMBO_MULTIPLIERS: Record<number, number> = {
  0: 1,
  1: 1,
  2: 1.5,
  3: 2,
  4: 2.5,
};
export const SESSION_COMBO_MAX_MULTIPLIER = 3; // 5+ sessions

export const DAILY_COMBO_TIERS = [
  { days: 3, multiplier: 1.5 },
  { days: 7, multiplier: 2 },
  { days: 14, multiplier: 2.5 },
  { days: 30, multiplier: 3 },
];

export function getSessionComboMultiplier(combo: number): number {
  if (combo >= 5) return SESSION_COMBO_MAX_MULTIPLIER;
  return SESSION_COMBO_MULTIPLIERS[combo] ?? 1;
}

export function getDailyComboMultiplier(streak: number): number {
  let multiplier = 1;
  for (const tier of DAILY_COMBO_TIERS) {
    if (streak >= tier.days) multiplier = tier.multiplier;
  }
  return multiplier;
}
```

- [ ] **Step 3: Create weekly goal templates**

```typescript
// constants/weekly-goals.ts — NEW FILE

export interface WeeklyGoalTemplate {
  metric: string;
  nameKey: string;
  descriptionKey: string;
  minValue: number;
  maxValue: number;
  baseXp: number;
}

export const WEEKLY_GOAL_TEMPLATES: WeeklyGoalTemplate[] = [
  { metric: 'pomodoros', nameKey: 'goals.pomodoros', descriptionKey: 'goals.pomodoros_desc', minValue: 10, maxValue: 30, baseXp: 100 },
  { metric: 'tasks', nameKey: 'goals.tasks', descriptionKey: 'goals.tasks_desc', minValue: 5, maxValue: 15, baseXp: 100 },
  { metric: 'streak_days', nameKey: 'goals.streak', descriptionKey: 'goals.streak_desc', minValue: 3, maxValue: 7, baseXp: 100 },
  { metric: 'focus_hours', nameKey: 'goals.focus_hours', descriptionKey: 'goals.focus_hours_desc', minValue: 3, maxValue: 10, baseXp: 100 },
  { metric: 'quest_days', nameKey: 'goals.quest_days', descriptionKey: 'goals.quest_days_desc', minValue: 3, maxValue: 7, baseXp: 100 },
];

export const SYSTEM_WEEKLY_GOAL_COUNT = 2;
export const WEEKLY_GOAL_ALL_COMPLETE_BONUS = 100;
export const PERSONAL_GOAL_XP = 150;
```

- [ ] **Step 4: Commit**

```bash
git add constants/daily-quests.ts constants/combo.ts constants/weekly-goals.ts
git commit -m "feat: add daily quest templates, combo multipliers, weekly goal templates"
```

---

### Task 0.5: Bug Fixes — Dead Code and Deduplication Prep

**Files:**
- Modify: `stores/todo-store.ts`
- Modify: `utils/pomodoro-helpers.ts`
- Create: `utils/theme-helpers.ts`
- Create: `utils/validators.ts`

- [ ] **Step 1: Remove `isLoading` dead code from todo-store.ts (B2)**

Remove the `isLoading: boolean` field from the store state interface and the `isLoading: false` initialization. Search for any references and remove them.

- [ ] **Step 2: Create theme-helpers.ts with shared color utilities**

```typescript
// utils/theme-helpers.ts — NEW FILE

import { Colors } from '@/constants/theme';

type ColorScheme = 'light' | 'dark';

export function getPriorityColor(priority: string, colorScheme: ColorScheme = 'light'): string {
  const colors = Colors[colorScheme];
  switch (priority) {
    case 'urgent': return colors.error;
    case 'high': return colors.warning;
    case 'medium': return colors.info;
    case 'low': return colors.success;
    default: return colors.textSecondary;
  }
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
```

- [ ] **Step 3: Create validators.ts scaffold**

```typescript
// utils/validators.ts — NEW FILE

export function validateTodoTitle(title: string): string | null {
  if (!title || title.trim().length === 0) return 'Title is required';
  if (title.trim().length > 500) return 'Title is too long';
  return null;
}

export function validateCategoryName(name: string): string | null {
  if (!name || name.trim().length === 0) return 'Name is required';
  if (name.trim().length > 100) return 'Name is too long';
  return null;
}

export function validateCategoryColor(color: string): string | null {
  if (!color) return 'Color is required';
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return 'Invalid hex color';
  return null;
}

export function validatePomodoroDuration(seconds: number): string | null {
  if (seconds <= 0) return 'Duration must be positive';
  if (seconds > 7200) return 'Duration cannot exceed 2 hours';
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
}

export function validateDisplayName(name: string): string | null {
  if (!name || name.trim().length === 0) return 'Name is required';
  if (name.trim().length > 50) return 'Name is too long';
  return null;
}
```

- [ ] **Step 4: Commit**

```bash
git add stores/todo-store.ts utils/theme-helpers.ts utils/validators.ts
git commit -m "fix: remove isLoading dead code, add theme helpers and validators"
```

---

### Task 0.6: Add .superpowers to .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add .superpowers/ to .gitignore**

Append `.superpowers/` to the end of `.gitignore`.

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers/ to gitignore"
```

---

## Phase 1: Auth & Supabase Setup

### Task 1.1: Apply Supabase Database Schema

**Files:**
- The SQL from the spec's Section 1.2

- [ ] **Step 1: Apply the full database migration via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with the complete SQL from the spec (tables, indexes, triggers, RLS policies). The migration should be named `001_initial_schema`.

- [ ] **Step 2: Verify tables exist**

Use `mcp__plugin_supabase_supabase__list_tables` with `verbose: true` to confirm all 9 tables (profiles, categories, todos, subtasks, pomodoro_sessions, achievements, daily_stats, daily_quests, weekly_goals) are created with correct columns.

- [ ] **Step 3: Test RLS by executing a query**

Use `mcp__plugin_supabase_supabase__execute_sql` to run:
```sql
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
```
Verify 9 `users_own_data` policies exist.

- [ ] **Step 4: Commit migration file if using local supabase CLI**

```bash
git add supabase/ || true
git commit -m "feat: apply Supabase database schema with RLS, indexes, triggers" || true
```

---

### Task 1.2: Auth Service Layer

**Files:**
- Modify: `utils/supabase.ts` (rename to `services/supabase/client.ts`)
- Create: `services/supabase/auth-service.ts`

- [ ] **Step 1: Move and update supabase client**

Move `utils/supabase.ts` to `services/supabase/client.ts`. Update the import to use the correct env variable names. Export as `supabase`.

- [ ] **Step 2: Create auth service**

```typescript
// services/supabase/auth-service.ts — NEW FILE

import { supabase } from './client';
import type { UserProfile } from '@/types/auth.types';

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, locale, prestige_count, created_at')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data ? {
    id: data.id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    locale: data.locale,
    prestigeCount: data.prestige_count,
    createdAt: data.created_at,
  } : null;
}

export async function updateProfile(updates: Partial<Pick<UserProfile, 'displayName' | 'avatarUrl' | 'locale'>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const dbUpdates: Record<string, unknown> = {};
  if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
  if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
  if (updates.locale !== undefined) dbUpdates.locale = updates.locale;

  const { error } = await supabase
    .from('profiles')
    .update(dbUpdates)
    .eq('id', user.id);

  if (error) throw error;
}

export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
```

- [ ] **Step 3: Update imports across codebase that reference old utils/supabase.ts path**

- [ ] **Step 4: Commit**

```bash
git add services/supabase/ utils/
git commit -m "feat: create auth service layer with signup, signin, profile management"
```

---

### Task 1.3: Auth Store

**Files:**
- Create: `stores/auth-store.ts`
- Modify: `stores/index.ts`

- [ ] **Step 1: Create auth store with Zustand + persist**

```typescript
// stores/auth-store.ts — NEW FILE

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import type { AuthState, UserProfile } from '@/types/auth.types';
import * as authService from '@/services/supabase/auth-service';

interface AuthStore extends AuthState {
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
  setSession: (session: Session | null) => void;
  setHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      session: null,
      isLoading: false,
      isHydrated: false,
      error: null,

      signUp: async (email, password, displayName) => {
        set({ isLoading: true, error: null });
        try {
          const { user, session } = await authService.signUp(email, password, displayName);
          set({ user: user ?? null, session: session ?? null, isLoading: false });
          if (user) await get().loadProfile();
        } catch (e: unknown) {
          set({ isLoading: false, error: (e as Error).message });
          throw e;
        }
      },

      signIn: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { user, session } = await authService.signIn(email, password);
          set({ user: user ?? null, session: session ?? null, isLoading: false });
          if (user) await get().loadProfile();
        } catch (e: unknown) {
          set({ isLoading: false, error: (e as Error).message });
          throw e;
        }
      },

      signOut: async () => {
        try {
          await authService.signOut();
        } finally {
          set({ user: null, profile: null, session: null, error: null });
        }
      },

      loadProfile: async () => {
        try {
          const profile = await authService.getProfile();
          set({ profile });
        } catch {
          // Profile load failure is non-fatal
        }
      },

      setSession: (session) => set({ session }),
      setHydrated: (value) => set({ isHydrated: value }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        session: state.session,
        user: state.user,
        profile: state.profile,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
```

- [ ] **Step 2: Export from stores/index.ts**

Add `export { useAuthStore } from './auth-store';` to `stores/index.ts`.

- [ ] **Step 3: Commit**

```bash
git add stores/auth-store.ts stores/index.ts
git commit -m "feat: create auth store with persist, signup, signin, profile"
```

---

### Task 1.4: Auth Screens — Login & Register

**Files:**
- Create: `app/(auth)/_layout.tsx`
- Create: `app/(auth)/login.tsx`
- Create: `app/(auth)/register.tsx`

- [ ] **Step 1: Create auth layout**

Simple Stack layout with no header, no back gesture. Screens: login, register.

- [ ] **Step 2: Create login screen**

Email input, password input, "Sign In" AnimatedButton, "Create Account" link to register. Uses `useAuthStore().signIn()`. Shows error text if `error` is set. Validates with `validateEmail` and `validatePassword` before submit.

- [ ] **Step 3: Create register screen**

Display name input, email input, password input, "Create Account" AnimatedButton, "Already have an account?" link to login. Uses `useAuthStore().signUp()`. Validates all fields.

- [ ] **Step 4: Commit**

```bash
git add app/\(auth\)/
git commit -m "feat: add login and register screens with validation"
```

---

### Task 1.5: Navigation Guard — Auth Routing

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/index.tsx`

- [ ] **Step 1: Update root layout to include auth state**

Add `useAuthStore` subscription. Set up `onAuthStateChange` listener in a useEffect to keep session state in sync.

- [ ] **Step 2: Update root router (app/index.tsx)**

```
if (!authStore.isHydrated || !settingsStore._hasHydrated) → Loading spinner
if (!authStore.session) → Redirect to /(auth)/login
if (!settingsStore.settings.onboardingCompleted) → Redirect to /(onboarding)/welcome
else → Redirect to /(tabs)
```

- [ ] **Step 3: Add (auth) to stack in _layout.tsx**

Add `<Stack.Screen name="(auth)" options={{ headerShown: false }} />` to the Stack navigator.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx app/index.tsx
git commit -m "feat: add auth navigation guard with session-based routing"
```

---

### Task 1.6: Personalized Greeting on Dashboard

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Add greeting with display name**

Import `useAuthStore`. Replace the static header title with:
```typescript
const { profile } = useAuthStore();
const greeting = profile?.displayName ? `Hoşgeldin, ${profile.displayName}` : 'Hoşgeldin';
```

Display this as the dashboard header text.

- [ ] **Step 2: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat: personalized greeting on dashboard using profile display name"
```

---

## Phase 2: Sync Engine

### Task 2.1: Sync Store

**Files:**
- Create: `stores/sync-store.ts`

- [ ] **Step 1: Create sync queue store**

Zustand store with AsyncStorage persist. State: `pendingOperations`, `lastSyncedAt`, `isSyncing`, `lastError`. Actions: `enqueue(table, type, data)`, `dequeue(opId)`, `incrementRetry(opId)`, `setSyncing(bool)`, `setLastSyncedAt(iso)`, `clearError()`. Uses `generateUUID()` for operation IDs. Persist only `pendingOperations` and `lastSyncedAt`.

- [ ] **Step 2: Commit**

```bash
git add stores/sync-store.ts
git commit -m "feat: create sync queue store with enqueue, dequeue, retry tracking"
```

---

### Task 2.2: Sync Service — Push

**Files:**
- Create: `services/sync/sync-service.ts`

- [ ] **Step 1: Create push sync service**

Implements `pushPendingOperations()`:
- Reads queue from sync store
- Groups by table
- For each operation: executes Supabase insert/update/delete
- On success: dequeue
- On failure: increment retry count, if retryCount >= 3 → log error and skip
- Exponential backoff: 1s, 2s, 4s delay between retries
- Returns `{ success: number, failed: number }`

- [ ] **Step 2: Commit**

```bash
git add services/sync/sync-service.ts
git commit -m "feat: sync push service with exponential backoff retry"
```

---

### Task 2.3: Sync Service — Pull & Merge

**Files:**
- Modify: `services/sync/sync-service.ts`

- [ ] **Step 1: Add pull and merge logic**

`pullRemoteChanges()`:
- Queries each table for `updated_at > lastSyncedAt`
- For soft-delete tables, includes deleted records (for sync awareness)
- Returns all changed records grouped by table

`mergeIntoLocalStores(remoteData)`:
- For each remote record:
  - Not in local → add to store
  - In local, remote `updated_at` > local → replace
  - In local, local is newer → keep local (it will push on next cycle)
  - Remote has `deleted_at` → mark local as deleted
- Updates `lastSyncedAt` to `now()`

- [ ] **Step 2: Commit**

```bash
git add services/sync/sync-service.ts
git commit -m "feat: sync pull and merge with last-write-wins conflict resolution"
```

---

### Task 2.4: Sync Hook — App Foreground

**Files:**
- Create: `hooks/use-sync.ts`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Create useSync hook**

Listens for AppState changes. On `active` (foreground): calls `pullRemoteChanges()` then `pushPendingOperations()`. Debounces to avoid rapid triggers. Only syncs if auth session exists.

- [ ] **Step 2: Add useSync to _layout.tsx**

Call `useSync()` in the root layout component.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-sync.ts app/_layout.tsx
git commit -m "feat: auto sync on app foreground with pull-then-push"
```

---

### Task 2.5: Integrate Sync Queue into Todo Store

**Files:**
- Modify: `stores/todo-store.ts`

- [ ] **Step 1: Enqueue operations on todo mutations**

In `addTodo()`, after local state update, call `useSyncStore.getState().enqueue('todos', 'insert', todoData)`.

Same for `updateTodo()` → enqueue 'update', `deleteTodo()` → set `deleted_at` locally + enqueue 'update' (soft delete).

- [ ] **Step 2: Same for subtask operations**

`addSubtask` → enqueue insert to 'subtasks', `updateSubtask` / `toggleSubtask` → enqueue update, `deleteSubtask` → enqueue soft delete.

- [ ] **Step 3: Commit**

```bash
git add stores/todo-store.ts
git commit -m "feat: integrate sync queue into todo and subtask operations"
```

---

### Task 2.6: Integrate Sync Queue into Category Store

**Files:**
- Modify: `stores/category-store.ts`

- [ ] **Step 1: Enqueue operations on category mutations**

Same pattern as todo store: `addCategory` → enqueue insert, `updateCategory` → enqueue update, `deleteCategory` → enqueue soft delete.

- [ ] **Step 2: Commit**

```bash
git add stores/category-store.ts
git commit -m "feat: integrate sync queue into category operations"
```

---

### Task 2.7: Sync Status Indicator Component

**Files:**
- Create: `components/common/sync-status.tsx`

- [ ] **Step 1: Create minimal sync indicator**

Shows a small icon/dot in dashboard header when `isSyncing` is true or `lastError` is set. Green dot = synced, spinning = syncing, red dot = error. Reads from `useSyncStore`.

- [ ] **Step 2: Commit**

```bash
git add components/common/sync-status.tsx
git commit -m "feat: add sync status indicator component"
```

---

## Phase 3: Pomodoro Timer Refactor

### Task 3.1: Timer State — Single Source of Truth

**Files:**
- Modify: `types/pomodoro.types.ts`
- Modify: `stores/pomodoro-store.ts`

- [ ] **Step 1: Update PomodoroTimerState type**

Add `totalPausedDuration: number` (cumulative pause time in seconds) and `notificationId?: string` to `PomodoroTimerState`. Keep `remainingTime` as derived state.

- [ ] **Step 2: Refactor tick() to use formula**

```typescript
// In pomodoro-store.ts tick():
const now = Date.now();
const elapsed = Math.floor((now - timer.startedAt) / 1000) - timer.totalPausedDuration;
const remaining = Math.max(0, timer.totalTime - elapsed);
// ... update remainingTime = remaining
```

- [ ] **Step 3: Refactor pause/resume**

`pauseTimer()`: set `pausedAt = Date.now()`, change state to 'paused'.
`resumeTimer()`: `totalPausedDuration += Math.floor((Date.now() - pausedAt) / 1000)`, clear `pausedAt`, change state to 'running', reschedule notification.

- [ ] **Step 4: Refactor _handleCompletion notification scheduling**

Calculate `completionTime = timer.startedAt + (timer.totalTime * 1000) + (timer.totalPausedDuration * 1000)` and pass absolute timestamp to `scheduleTimerNotification()`.

- [ ] **Step 5: Commit**

```bash
git add types/pomodoro.types.ts stores/pomodoro-store.ts
git commit -m "fix: refactor timer to single source of truth with totalPausedDuration"
```

---

### Task 3.2: Notification Scheduling Fix

**Files:**
- Modify: `services/background/pomodoro-task.ts`

- [ ] **Step 1: Update scheduleTimerNotification signature**

Change from `(phase, remainingSeconds, options?)` to `(phase, completionTimeMs: number, options?)`. Calculate trigger date from `completionTimeMs`.

```typescript
export async function scheduleTimerNotification(
  phase: PomodoroPhase,
  completionTimeMs: number,
  options?: { sound?: boolean; vibration?: boolean }
): Promise<string | undefined> {
  await cancelScheduledTimerNotifications();
  const triggerDate = new Date(completionTimeMs);
  if (triggerDate.getTime() <= Date.now()) return undefined;
  // ... schedule with triggerDate
}
```

- [ ] **Step 2: Update all callers to pass completionTimeMs**

Update pomodoro-store.ts and background-task.ts to compute and pass `completionTimeMs` instead of `remainingSeconds`.

- [ ] **Step 3: Commit**

```bash
git add services/background/pomodoro-task.ts stores/pomodoro-store.ts
git commit -m "fix: notification scheduling uses absolute completionTime timestamp"
```

---

### Task 3.3: Background Task Update

**Files:**
- Modify: `services/background/background-task.ts`

- [ ] **Step 1: Refactor background task to use completionTime formula**

Replace the `remainingTime` countdown logic with:
```
completionTime = startedAt + (totalTime * 1000) + (totalPausedDuration * 1000)
elapsed = now - startedAt - (totalPausedDuration * 1000)
```
On phase completion, reschedule notification for next phase's `completionTime`.

- [ ] **Step 2: Add try/catch with error logging (B5)**

Wrap all AsyncStorage reads/writes in try/catch. On read failure, return early (don't crash background task). On write failure, log warning.

- [ ] **Step 3: Commit**

```bash
git add services/background/background-task.ts
git commit -m "fix: background task uses completionTime formula, adds error handling"
```

---

### Task 3.4: Fix completeSession Duplication (B3)

**Files:**
- Modify: `stores/pomodoro-store.ts`

- [ ] **Step 1: Refactor completeSession to use _handleCompletion**

Remove duplicated completion logic from `completeSession()`. Have it call `_handleCompletion()` instead, or extract shared logic into a private `_finishPhase()` method both use.

- [ ] **Step 2: Commit**

```bash
git add stores/pomodoro-store.ts
git commit -m "fix: remove completeSession duplication, use shared _handleCompletion"
```

---

### Task 3.5: Rehydration Sync Update

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Update usePomodoroRehydrationSync**

On rehydration, if timer was running:
- Calculate `completionTime` using the formula
- If `completionTime` is in the past → handle completed phases
- If `completionTime` is in the future → reschedule notification, update `remainingTime`

- [ ] **Step 2: Commit**

```bash
git add app/_layout.tsx
git commit -m "fix: rehydration sync uses completionTime formula for consistency"
```

---

### Task 3.6: Pomodoro Session Sync to Supabase

**Files:**
- Modify: `stores/pomodoro-store.ts`

- [ ] **Step 1: Enqueue pomodoro session on completion**

In `_handleCompletion()`, after creating the session record, enqueue it to sync store:
```typescript
useSyncStore.getState().enqueue('pomodoro_sessions', 'insert', {
  id: session.id,
  user_id: useAuthStore.getState().user?.id,
  todo_id: timer.linkedTodoId,
  phase: session.phase,
  duration: session.duration,
  target_duration: session.targetDuration,
  was_completed: session.wasCompleted,
  started_at: session.startedAt,
  ended_at: session.endedAt,
  paused_duration: session.pausedDuration,
});
```

- [ ] **Step 2: Commit**

```bash
git add stores/pomodoro-store.ts
git commit -m "feat: sync pomodoro sessions to Supabase on completion"
```

---

## Phase 4-8: Remaining Phases

> **Note:** Phases 4-8 follow the same detailed pattern. Due to the immense scope (81 achievements, 50 levels, combo system, daily quests, weekly goals, prestige, daily summary modal, i18n with 300+ keys, test infrastructure), each phase will be expanded into full step-by-step tasks when Phase 3 is complete.
>
> **Phase 4:** Gamification V1 — 7 tasks covering 50-level constants, gamification store refactor (B6 fix), 81 achievement definitions and checking, XP economy update, achievement sync, dashboard integration, tests.
>
> **Phase 5:** Advanced Gamification — 8 tasks covering daily quest store and generation service, weekly goal store and generation, session combo in pomodoro store, daily combo tracking, combo stacking math, prestige service with monthly reset, combo/prestige achievements, notification flow.
>
> **Phase 6:** UX Enhancements — 7 tasks covering daily summary modal with 11 metrics, 23:00 notification scheduling, dashboard component extraction (5 new files), theme helper integration across 5 screens, onboarding auth flow update, settings expansion with account management, combo/prestige UI.
>
> **Phase 7:** i18n — 6 tasks covering i18next + expo-localization setup, TR/EN translation files (300+ keys across 10 namespaces), string extraction from all screens, settings language selector, achievement/quest localization, date-fns locale integration.
>
> **Phase 8:** Test & Polish — 7 tasks covering Jest + RTL setup with mocks, store unit tests (6 stores, 80+ cases), util/helper tests, gamification calculation tests, integration tests (5 suites), UI component tests, E2E scenario documentation.
>
> Each phase will be written with full code blocks, exact file paths, and test commands when its predecessor is complete. This prevents the plan from becoming stale as earlier phases may change the codebase structure.

---

## File Map Summary

### New Files (Phase 0-3)
```
types/sync.types.ts
types/auth.types.ts
constants/daily-quests.ts
constants/combo.ts
constants/weekly-goals.ts
utils/theme-helpers.ts
utils/validators.ts
services/supabase/client.ts (moved from utils/supabase.ts)
services/supabase/auth-service.ts
stores/auth-store.ts
stores/sync-store.ts
services/sync/sync-service.ts
hooks/use-sync.ts
components/common/sync-status.tsx
app/(auth)/_layout.tsx
app/(auth)/login.tsx
app/(auth)/register.tsx
```

### Modified Files (Phase 0-3)
```
types/gamification.types.ts — combo, prestige, quest, goal types
types/pomodoro.types.ts — totalPausedDuration, notificationId
types/settings.types.ts — language field
types/index.ts — new exports
constants/gamification.ts — 50 levels, 81 achievements, updated XP
stores/todo-store.ts — remove isLoading, add sync queue
stores/category-store.ts — add sync queue
stores/pomodoro-store.ts — timer refactor, session sync, fix B3
stores/index.ts — export auth store
services/background/background-task.ts — completionTime formula, error handling
services/background/pomodoro-task.ts — absolute timestamp scheduling
app/_layout.tsx — auth guard, sync hook, rehydration update
app/index.tsx — auth routing
app/(tabs)/index.tsx — personalized greeting
.gitignore — add .superpowers/
```

### Future Files (Phase 4-8)
```
services/gamification/daily-quests.ts
services/gamification/weekly-goals.ts
services/gamification/prestige-service.ts
services/gamification/daily-summary.ts
services/sync/gamification-sync.ts
services/i18n/i18n-config.ts
stores/daily-quests-store.ts
stores/weekly-goals-store.ts
components/dashboard/xp-progress-card.tsx
components/dashboard/quick-stats-grid.tsx
components/dashboard/timer-status-card.tsx
components/dashboard/active-tasks-list.tsx
components/dashboard/quick-actions.tsx
components/dashboard/daily-summary-modal.tsx
components/dashboard/daily-quests-card.tsx
components/dashboard/weekly-goals-card.tsx
components/settings/pomodoro-settings.tsx
components/settings/notification-settings.tsx
components/settings/appearance-settings.tsx
components/settings/category-manager.tsx
components/settings/language-settings.tsx
components/settings/account-settings.tsx
components/todo/todo-detail-view.tsx
components/todo/todo-edit-form.tsx
components/todo/subtask-list.tsx
locales/tr.json
locales/en.json
jest.config.js
jest.setup.ts
__tests__/stores/*.test.ts (6 files)
__tests__/utils/*.test.ts (4 files)
__tests__/integration/*.test.ts (5 files)
__tests__/components/*.test.ts (5+ files)
```
