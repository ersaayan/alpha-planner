# Alpha Planner Full Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all ~350 reported bugs, integrate Supabase full cloud sync with auth, and add 4 new features (undo, recurring tasks, pomodoro stats, test infrastructure).

**Architecture:** Offline-first with pull-based sync. Local Zustand stores remain the source of truth for UI. A sync layer pushes/pulls changes to/from Supabase. Auth gates the app entry. All tables use RLS with `user_id = auth.uid()`.

**Tech Stack:** React Native (Expo SDK 54), Zustand, Supabase (Auth + PostgreSQL + RLS), date-fns, react-native-reanimated, Jest + RNTL for tests.

**Design Doc:** `docs/plans/2026-03-02-full-overhaul-design.md`

---

## Phase Overview

| Phase | Name | Tasks | Depends On |
|-------|------|-------|------------|
| 1 | Config & Foundation | 8 | - |
| 2 | Supabase Infrastructure | 10 | Phase 1 |
| 3 | Store Overhaul + Core Bug Fixes | 18 | Phase 1 |
| 4 | Sync Service | 12 | Phase 2, 3 |
| 5 | Animation & UI Fixes | 14 | Phase 3 |
| 6 | Notification & Background Fixes | 11 | Phase 3 |
| 7 | Accessibility & Refactor | 10 | Phase 5, 6 |
| 8 | New Features | 12 | Phase 4, 7 |
| 9 | Test Infrastructure | 10 | Phase 8 |
| 10 | Final Verification | 5 | Phase 9 |

---

## Phase 1: Config & Foundation

### Task 1.1: Fix package.json dependency versions

**Files:**
- Modify: `package.json:17,25,26,34,37,43`

**Step 1: Fix version ranges from ^ to ~ for Expo SDK 54 compatibility**

Change these lines in `package.json`:
```json
"@react-native-async-storage/async-storage": "2.2.0",
"expo-av": "~16.0.8",
"expo-background-fetch": "~14.0.9",
"expo-keep-awake": "~15.0.8",
"expo-notifications": "~0.32.16",
"expo-task-manager": "~14.0.9",
```

**Step 2: Remove unused dependencies**

Remove these from `dependencies`:
- `expo-av`
- `expo-image`
- `expo-web-browser`
- `expo-symbols`

**Step 3: Fix packageManager field**

Replace line 64 with:
```json
"packageManager": "npm@10.0.0"
```

Or remove the field entirely since project uses npm (has package-lock.json).

**Step 4: Add Supabase dependencies**

```bash
npx expo install @supabase/supabase-js react-native-url-polyfill
```

**Step 5: Add test dependencies**

```bash
npm install -D jest jest-expo @testing-library/react-native @testing-library/jest-native @types/jest
```

**Step 6: Add test script to package.json**

Add to `scripts`:
```json
"test": "jest",
"test:watch": "jest --watch",
"test:coverage": "jest --coverage"
```

**Step 7: Run `npm install` and verify no errors**

```bash
npm install
```

**Step 8: Commit**

```bash
git add package.json package-lock.json
git commit -m "fix: update dependency versions, remove unused deps, add supabase and test deps"
```

---

### Task 1.2: Fix eas.json production build type

**Files:**
- Modify: `eas.json:24-27`

**Step 1: Change APK to AAB for production**

Replace lines 24-27:
```json
"production": {
  "android": {
    "buildType": "aab"
  },
```

**Step 2: Add channel configuration for EAS Update**

Add `channel` to each profile:
```json
"development": {
  "channel": "development",
  ...
},
"preview": {
  "channel": "preview",
  ...
},
"production": {
  "channel": "production",
  ...
}
```

**Step 3: Commit**

```bash
git add eas.json
git commit -m "fix: change production build to AAB, add EAS Update channels"
```

---

### Task 1.3: Fix app.json plugins and config

**Files:**
- Modify: `app.json:45-70`

**Step 1: Add missing plugins**

Add to the `plugins` array after existing entries:
```json
"expo-background-fetch",
"expo-task-manager"
```

**Step 2: Commit**

```bash
git add app.json
git commit -m "fix: add missing expo plugins for background fetch and task manager"
```

---

### Task 1.4: Add tsconfig exclude array

**Files:**
- Modify: `tsconfig.json`

**Step 1: Add exclude array**

Add after `include`:
```json
"exclude": [
  "node_modules",
  "android",
  "ios",
  ".expo",
  "dist"
]
```

**Step 2: Commit**

```bash
git add tsconfig.json
git commit -m "chore: add exclude array to tsconfig"
```

---

### Task 1.5: Delete dead code files

**Files:**
- Delete: `components/haptic-tab.tsx`
- Delete: `components/ui/icon-symbol.tsx`
- Delete: `components/ui/icon-symbol.ios.tsx`

**Step 1: Delete the files**

```bash
rm components/haptic-tab.tsx
rm components/ui/icon-symbol.tsx
rm components/ui/icon-symbol.ios.tsx
```

**Step 2: Verify no imports reference these files**

```bash
grep -r "haptic-tab\|icon-symbol" --include="*.ts" --include="*.tsx" . --exclude-dir=node_modules
```

Expected: No results (these files are confirmed unused).

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove dead code files (haptic-tab, icon-symbol)"
```

---

### Task 1.6: Clean dead constants and exports

**Files:**
- Modify: `constants/defaults.ts` -- remove `TAB_BAR_HEIGHT`
- Modify: `constants/theme.ts` -- remove `Shadows.glow`, `AnimationDurations` re-export
- Modify: `constants/gamification.ts` -- remove `XP_VALUES.ACHIEVEMENT_UNLOCK`

**Step 1: Remove dead constants from each file**

In `constants/defaults.ts`: remove the `TAB_BAR_HEIGHT` line.

In `constants/theme.ts`: remove the `glow` function from `Shadows` object, remove `AnimationDurations` re-export at end of file.

In `constants/gamification.ts`: remove `ACHIEVEMENT_UNLOCK: 100` from `XP_VALUES`.

**Step 2: Verify no imports break**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add constants/
git commit -m "chore: remove dead constants (TAB_BAR_HEIGHT, Shadows.glow, AnimationDurations, ACHIEVEMENT_UNLOCK)"
```

---

### Task 1.7: Extract shared utilities (DRY refactor)

**Files:**
- Create: `utils/priority.ts`
- Create: `constants/priorities.ts`
- Create: `constants/channels.ts`
- Modify: `utils/pomodoro-helpers.ts` -- fix idle phase return, become single source of truth
- Create: `hooks/use-category-lookup.ts`
- Create: `components/common/view-header.tsx`

**Step 1: Create `constants/priorities.ts`**

```typescript
import { Colors } from './theme';

export const PRIORITIES = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' },
] as const;

export function getPriorityColor(
  priority: string,
  colors: typeof Colors.light
): string {
  switch (priority) {
    case 'urgent': return colors.priorityUrgent;
    case 'high': return colors.priorityHigh;
    case 'medium': return colors.priorityMedium;
    default: return colors.priorityLow;
  }
}
```

**Step 2: Create `constants/channels.ts`**

```typescript
export const COMPLETION_CHANNELS = {
  soundVibrate: 'pomodoro',
  soundOnly: 'pomodoro-sound',
  vibrateOnly: 'pomodoro-vibrate',
  silent: 'pomodoro-silent',
} as const;
```

**Step 3: Fix `utils/pomodoro-helpers.ts` idle case**

Change `return 0` to `return settings.focusDuration` for idle phase to match store and background task behavior.

**Step 4: Create `hooks/use-category-lookup.ts`**

```typescript
import { useMemo } from 'react';
import { useCategoryStore } from '@/stores';
import { Palette } from '@/constants/theme';

export function useCategoryLookup() {
  const categories = useCategoryStore((state) => state.categories);

  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    categories.forEach((c) => map.set(c.id, { name: c.name, color: c.color }));
    return map;
  }, [categories]);

  return {
    getCategoryColor: (id: string | null): string => {
      if (!id) return Palette.sage;
      return categoryMap.get(id)?.color ?? Palette.sage;
    },
    getCategoryName: (id: string | null): string | undefined => {
      if (!id) return undefined;
      return categoryMap.get(id)?.name;
    },
  };
}
```

**Step 5: Create `components/common/view-header.tsx`**

```typescript
import { useRouter } from 'expo-router';
import { Pressable, View, StyleSheet } from 'react-native';
import { Text } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { Colors, Spacing, FontSize, InterFonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ViewHeaderProps {
  title: string;
}

export function ViewHeader({ title }: ViewHeaderProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
        <Icon name="arrow-back" fill={colors.text} style={{ width: 24, height: 24 }} />
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  title: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xl,
  },
});
```

**Step 6: Update barrel exports**

Add to `components/common/index.ts`:
```typescript
export { ViewHeader } from './view-header';
```

**Step 7: Commit**

```bash
git add utils/ constants/ hooks/ components/common/
git commit -m "refactor: extract shared utilities (priorities, channels, category-lookup, view-header, pomodoro-helpers fix)"
```

---

### Task 1.8: Fix icon.tsx issues

**Files:**
- Modify: `components/icon.tsx`

**Step 1: Fix console.warn to use __DEV__ guard**

Change:
```typescript
console.warn(`Icon "${name}" not found in mapping, using default`);
```
To:
```typescript
if (__DEV__) console.warn(`Icon "${name}" not found in mapping, using default`);
```

**Step 2: Fix unsafe style cast**

Change:
```typescript
const styleObj = style as { width?: number; height?: number } | undefined;
```
To:
```typescript
const flatStyle = StyleSheet.flatten(style) as { width?: number; height?: number } | undefined;
```

Add `StyleSheet` to the import from `react-native`.

**Step 3: Commit**

```bash
git add components/icon.tsx
git commit -m "fix: icon.tsx DEV guard for console.warn, safe style cast with StyleSheet.flatten"
```

---

## Phase 2: Supabase Infrastructure

### Task 2.1: Create database schema with migrations

**Files:**
- Supabase migrations (via plugin)

**Step 1: Create profiles table + RLS**

Apply migration via Supabase plugin with the full schema for `profiles`, `categories`, `todos`, `subtasks`, `pomodoro_sessions`, `achievements`, `daily_stats` tables. Include:
- All columns as specified in design doc
- RLS policies (`user_id = auth.uid()`) on all tables
- `updated_at` auto-update trigger
- Indexes on `user_id` + foreign keys
- Soft delete support (`deleted_at` column)

**Step 2: Create auto-create profile trigger**

On `auth.users` insert → auto-create `profiles` row with defaults.

**Step 3: Verify tables exist**

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

**Step 4: Commit migration files if using local Supabase CLI (otherwise, migrations are in Supabase dashboard)**

---

### Task 2.2: Create auth screen layout

**Files:**
- Create: `app/(auth)/_layout.tsx`
- Create: `app/(auth)/login.tsx`
- Create: `app/(auth)/register.tsx`
- Create: `app/(auth)/forgot-password.tsx`

Auth screens with Email/Password + Google OAuth + Apple OAuth.
Design consistent with existing onboarding screens using UI Kitten components and Inter fonts.

---

### Task 2.3: Update app entry point for auth routing

**Files:**
- Modify: `app/index.tsx`
- Modify: `app/_layout.tsx`

Update `index.tsx` to check Supabase session:
1. Hydrate settings store
2. Check `supabase.auth.getSession()`
3. No session → redirect to `/(auth)/login`
4. Session + not onboarded → redirect to `/(onboarding)/welcome`
5. Session + onboarded → redirect to `/(tabs)`

Add hydration timeout (10s → fallback to defaults).

Update `_layout.tsx`:
- Add `(auth)` Stack.Screen
- Add `supabase.auth.onAuthStateChange` listener
- Create profile on first login if not exists

---

### Task 2.4: Create auth service

**Files:**
- Create: `services/auth/auth-service.ts`
- Create: `services/auth/index.ts`

Functions: `signInWithEmail`, `signUpWithEmail`, `signInWithGoogle`, `signInWithApple`, `signOut`, `resetPassword`, `getCurrentUser`, `onAuthStateChange`.

---

### Task 2.5: Add logout to settings screen

**Files:**
- Modify: `app/(tabs)/settings.tsx`

Add logout button at bottom of settings. On press: clear local stores, sign out of Supabase, navigate to auth.

---

### Tasks 2.6-2.10: Profile sync on login, Google OAuth config, Apple OAuth config, session refresh, error handling

(Detailed in sub-plan files)

---

## Phase 3: Store Overhaul + Core Bug Fixes

### Task 3.1: Rewrite todo-store.ts

**Files:**
- Modify: `stores/todo-store.ts`
- Modify: `types/todo.types.ts`

All fixes from report Category 1 applied:
- Fix `addTodo` Omit type (add `order`, `completedAt`)
- Move `order` calculation inside `set()`
- Protect immutable fields in `updateTodo`/`updateSubtask`
- Fix `toggleTodoStatus` to preserve `in_progress`
- Remove dead `isLoading` state
- Fix `getFilteredTodos` reference stability (shallow compare)
- Fix `migrate` with proper validation
- Add `deleted_at` field for soft delete
- Add `is_recurring` + `recurrence_rule` fields
- Use `XP_VALUES.SUBTASK_COMPLETE` constant
- Add sync meta support
- Fix `reorderTodos` duplicate order values
- Guard non-existent todoId in subtask operations
- Single timestamp for `updatedAt`/`completedAt`
- Cross-store error handling (try/catch)

---

### Task 3.2: Rewrite pomodoro-store.ts

**Files:**
- Modify: `stores/pomodoro-store.ts`

All fixes:
- Wall-clock based `tick()` (use `Date.now() - startedAt`)
- Fix `syncTimer` to use `totalTime` not `remainingTime`
- Make `syncTimer` loop non-reactive (calculate all, single `set()`)
- Add `state === 'paused'` guard to `resumeTimer`
- Remove dead `completeSession` and `setPhase` methods
- Fix `getProgress`/`formatTime` to be reactive selectors
- Import from shared `pomodoro-helpers.ts`
- Type-safe phase handling (no unsafe casts)
- Defensive negative `remainingTime` handling
- Add sync meta support
- Fix `startTimer` to reject paused state properly

---

### Task 3.3: Rewrite gamification-store.ts

**Files:**
- Modify: `stores/gamification-store.ts`

All fixes:
- Add `default` case in `checkAchievements` switch
- Fix single-pass achievement miss
- `addXp` negative guard
- `completedAt` propagation to `updateStreak`/`updateDailyStats`
- Max level progress 100% (not 0%)
- Fix `migrate` with proper validation (no `as any`)
- `dailyStats` 90-day cap in migration
- `pendingNotifications` cleanup on startup
- Remove redundant `currentXp` (derive from `totalXp` + `level`)
- Remove unused `notified` field reads
- Add sync meta support

---

### Task 3.4: Rewrite settings-store.ts

**Files:**
- Modify: `stores/settings-store.ts`

All fixes:
- Fix `partialize` to explicitly list data fields only
- Fix `updatePomodoroSettings` to not reject entire update for one bad value
- Add runtime validation to `updateSettings`
- Fix `onRehydrateStorage` to check for errors
- Fix `resetAllData` to cancel notifications, unregister background task
- Add upper bound validation for pomodoro durations
- Add sync meta support

---

### Task 3.5: Rewrite category-store.ts

**Files:**
- Modify: `stores/category-store.ts`

All fixes:
- Add `partialize` (exclude action functions)
- Fix index-based ID coupling (use keyed mapping)
- Protect identity fields in `updateCategory`
- Fix `reorderCategories` duplicate order values
- Fix `keepOnlyCategories` orphan cleanup
- Auto-assign `order` in `addCategory`
- Fix `migrate` to forward-fill category fields with defaults
- Move getter functions out of store (use hook)
- Add sync meta support

---

### Tasks 3.6-3.18: Store barrel update, type updates, useColorScheme default fix, colorScheme ?? 'light' elimination, etc.

(Each task is a focused, atomic change with commit)

---

## Phase 4: Sync Service

### Tasks 4.1-4.12: Sync orchestrator, queue, table-specific sync modules, conflict resolution, debounced push, pull on foreground, profile sync, integration with stores

---

## Phase 5: Animation & UI Fixes

### Tasks 5.1-5.14: cancelAnimation cleanups, visible reset, stale closures, shimmer fix, FlatList extraData, kanban pressable, calendar date reset, timeline archived filter, toast safe area, timer card functional, etc.

---

## Phase 6: Notification & Background Fixes

### Tasks 6.1-6.11: Permission checks, soundEnabled path, permission cache, cancelAll map clear, resetAllData cleanup, bg task registration, double rehydration elimination, hydration timeout, notification retry, etc.

---

## Phase 7: Accessibility & Refactor

### Tasks 7.1-7.10: Tab bar roles, status tabs, chart roles, category cards, color picker labels, section header role, ErrorBoundary dark mode, inline style cleanup, etc.

---

## Phase 8: New Features

### Task 8.1: Undo system

**Files:**
- Create: `stores/undo-store.ts`
- Create: `components/common/undo-snackbar.tsx`
- Modify: `stores/todo-store.ts` -- wrap delete/toggle in undo-aware wrappers
- Modify: `stores/category-store.ts` -- wrap delete in undo-aware wrapper
- Modify: `app/_layout.tsx` -- render UndoSnackbar

### Task 8.2-8.4: Undo integration with todo, category, and subtask operations

### Task 8.5: Recurring tasks

**Files:**
- Create: `utils/recurrence.ts`
- Modify: `types/todo.types.ts` -- add recurrence fields
- Modify: `stores/todo-store.ts` -- auto-create next instance on complete
- Modify: `app/todo/create.tsx` -- add recurrence picker
- Modify: `app/todo/[id].tsx` -- show/edit recurrence

### Task 8.6-8.8: Recurrence picker UI, auto-creation logic, sync support

### Task 8.9: Pomodoro detailed statistics

**Files:**
- Create: `components/charts/focus-time-chart.tsx`
- Modify: `app/(tabs)/stats.tsx` -- add "Focus Time by Task" section

### Task 8.10-8.12: Chart implementation, filter toggle, integration

---

## Phase 9: Test Infrastructure

### Task 9.1: Jest configuration

**Files:**
- Create: `jest.config.js`
- Create: `jest.setup.js`

### Task 9.2-9.4: Store tests (todo-store, pomodoro-store, gamification-store)

### Task 9.5-9.6: Utility tests (date, recurrence, pomodoro-helpers)

### Task 9.7-9.8: Sync service tests

### Task 9.9-9.10: Component snapshot tests, CI integration

---

## Phase 10: Final Verification

### Task 10.1: TypeScript compile check
### Task 10.2: ESLint pass
### Task 10.3: Full test suite run
### Task 10.4: Manual smoke test checklist
### Task 10.5: Final commit and version bump
