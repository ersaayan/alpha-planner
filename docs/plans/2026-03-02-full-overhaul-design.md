# Alpha Planner Full Overhaul Design

**Date:** 2026-03-02
**Approach:** Foundation First (A)
**Scope:** ~350 bug fixes + Supabase Full Cloud Sync + 4 new features

---

## 1. Supabase Database Schema

### profiles
- `id` (uuid, PK, FK → auth.users)
- `display_name` (text)
- `avatar_url` (text, nullable)
- `settings` (jsonb) -- theme, dateFormat, hapticFeedbackEnabled, notificationsEnabled, weekStartsOn, defaultView
- `pomodoro_settings` (jsonb) -- focusDuration, shortBreakDuration, longBreakDuration, sessionsUntilLongBreak, autoStartBreaks, autoStartPomodoros, soundEnabled, vibrationEnabled
- `gamification_stats` (jsonb) -- totalXp, level, currentXp, currentStreak, longestStreak, totalTasksCompleted, totalPomodorosCompleted, totalFocusTime, lastActiveDate
- `has_completed_onboarding` (bool, default false)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### categories
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles, NOT NULL)
- `name` (text, NOT NULL)
- `color` (text, NOT NULL)
- `icon` (text, NOT NULL)
- `order` (int, NOT NULL, default 0)
- `is_default` (bool, default false)
- `deleted_at` (timestamptz, nullable) -- soft delete
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### todos
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles, NOT NULL)
- `category_id` (uuid, FK → categories, nullable)
- `title` (text, NOT NULL)
- `description` (text, nullable)
- `status` (text CHECK: pending, in_progress, completed, archived)
- `priority` (text CHECK: low, medium, high, urgent)
- `due_date` (timestamptz, nullable)
- `completed_at` (timestamptz, nullable)
- `estimated_pomodoros` (int, nullable)
- `pomodoro_sessions` (int, default 0)
- `order` (int, NOT NULL, default 0)
- `is_recurring` (bool, default false)
- `recurrence_rule` (jsonb, nullable) -- {type, interval, daysOfWeek?}
- `deleted_at` (timestamptz, nullable) -- soft delete
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### subtasks
- `id` (uuid, PK)
- `todo_id` (uuid, FK → todos, ON DELETE CASCADE)
- `user_id` (uuid, FK → profiles, NOT NULL)
- `title` (text, NOT NULL)
- `is_completed` (bool, default false)
- `order` (int, NOT NULL, default 0)
- `deleted_at` (timestamptz, nullable)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### pomodoro_sessions
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles, NOT NULL)
- `todo_id` (uuid, FK → todos, nullable)
- `phase` (text CHECK: focus, short_break, long_break)
- `duration` (int, NOT NULL) -- seconds
- `was_completed` (bool, default false)
- `started_at` (timestamptz, NOT NULL)
- `ended_at` (timestamptz, nullable)
- `created_at` (timestamptz)

### achievements
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles, NOT NULL)
- `achievement_id` (text, NOT NULL) -- 'first_task', 'streak_7', etc.
- `unlocked_at` (timestamptz, NOT NULL)
- `xp_reward` (int, NOT NULL)
- UNIQUE(user_id, achievement_id)

### daily_stats
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles, NOT NULL)
- `date` (date, NOT NULL)
- `tasks_completed` (int, default 0)
- `pomodoros_completed` (int, default 0)
- `focus_minutes` (int, default 0)
- UNIQUE(user_id, date)

### Design decisions
- RLS on all tables: `user_id = auth.uid()`
- `updated_at` auto-trigger for conflict resolution (last-write-wins)
- Soft delete with `deleted_at` for sync propagation
- 30-day cron for hard delete of soft-deleted records
- JSONB for settings/stats: always read with profile, no separate queries needed

---

## 2. Authentication Flow

### Screens
- `app/(auth)/login.tsx` -- Email/password + Google/Apple OAuth buttons
- `app/(auth)/register.tsx` -- Registration form
- `app/(auth)/forgot-password.tsx` -- Password reset via email

### Navigation
- `app/index.tsx`: hydrate → check Supabase session → route to auth/onboarding/tabs
- First registration → onboarding flow → `profiles.has_completed_onboarding = true`
- Logout: clear local stores + end Supabase session + navigate to auth

### Token management
- Existing `utils/supabase.ts` setup handles token persistence and refresh
- `supabase.auth.onAuthStateChange` listener in root layout
- Session refresh on app foreground

### Auth methods
- Email/password (register + login)
- Google OAuth
- Apple OAuth (iOS)
- Password reset via magic link email

---

## 3. Sync Architecture (Offline-First + Pull-based)

### Write path
1. User action → local store updates immediately (instant UI)
2. Change added to sync queue with timestamp
3. If online: push to Supabase immediately (debounced 2s)
4. If offline: queue persisted in AsyncStorage, pushed when online

### Read path (Pull)
1. App foreground → fetch changes since `lastSyncedAt`
2. Merge into local store (last-write-wins via `updated_at`)
3. Update `lastSyncedAt` timestamp

### Sync triggers
- App comes to foreground (AppState change)
- After auth state change (full pull on login)
- Manual pull-to-refresh
- After local mutation (debounced 2s push)

### Conflict resolution
- Compare `updated_at` timestamps
- Server newer → server wins
- Local newer → local wins (push to server)

### File structure
```
services/sync/
├── sync-service.ts        -- Main orchestrator
├── sync-queue.ts          -- Offline queue management
├── sync-helpers.ts        -- Conflict resolution, merge logic
├── table-syncs/
│   ├── todos-sync.ts
│   ├── categories-sync.ts
│   ├── sessions-sync.ts
│   ├── profile-sync.ts
│   └── achievements-sync.ts
└── index.ts
```

### Store changes
- Each store gets `_syncMeta: { lastSyncedAt, pendingChanges[] }`
- Mutations tagged as `localOnly` or `synced`
- `partialize` updated to persist sync meta
- Soft delete: `deleted_at` timestamp instead of hard delete

---

## 4. Bug Fix Strategy (7 Categories)

### Category 1 -- Store Core Fixes (done alongside Supabase integration)
- Timer wall-clock based `tick()` (drift fix)
- `syncTimer` correct calculation (use `totalTime`)
- `resumeTimer` state guard (`state === 'paused'`)
- `addTodo` missing Omit fields + `completedAt: null`
- `updateTodo`/`updateSubtask` immutable field protection
- `addXp` negative guard
- `completedAt` propagation to streak/dailyStats
- All `migrate` functions proper validation
- `getFilteredTodos` reference stability
- `order` calculation inside `set()`
- Cross-store atomic reset
- Dead state (`isLoading`) removal
- `XP_VALUES.SUBTASK_COMPLETE` constant usage
- Max level XP progress fix (show 100% not 0%)
- `checkAchievements` default case
- `toggleTodoStatus` preserve in_progress state
- Non-atomic `syncTimer` loop fix (single `set()`)

### Category 2 -- Animation Fixes
- All `cancelAnimation` cleanups (badge, checkbox, counter, progress-bar)
- Achievement/Toast `visible=false` reset
- Stale closure fixes (`onClose`, `onHide` deps)
- Shimmer restart fix (decouple from progress)
- Counter first render bounce fix
- `withRepeat` reverse flag cleanup
- `FAB` barrel export
- Redundant identity interpolation in checkbox
- Negative delay guards (`Math.max(..., 0)`)
- Android shadow fallback (elevation)

### Category 3 -- UI/UX Fixes
- Kanban nested pressable fix (stopPropagation)
- FlatList `extraData` for theme/settings changes
- Orphaned category chip guard
- Calendar selected date reset on month change
- Timeline archived todo filter
- Toast safe area inset (useSafeAreaInsets)
- Timer card play/pause functional
- Timer stale after warm background fix
- Category name length + duplicate validation
- Subtask delete confirmation dialog
- Todo delete unlinks from pomodoro
- Date range timezone normalization
- View status filtering consistency across kanban/calendar/timeline
- Invalid date string guards

### Category 4 -- Notification & Background Fixes
- Permission check in pomodoro-task scheduleTimerNotification
- `soundEnabled` correct settings path
- Permission cache both granted and denied states
- `cancelAllNotifications` clear task-due map
- `resetAllData` cancel notifications + unregister background task
- Background task registration on app background
- Double rehydration sync elimination
- Store hydration timeout (10s fallback to defaults)
- Notification init retry mechanism
- `remainingSeconds <= 0` cancel existing notification
- Read-modify-write race mitigation (read-then-merge before write)

### Category 5 -- Accessibility
- Tab bar: `accessibilityRole="tab"` + container `"tablist"`
- Status tabs: `accessibilityRole="tab"` + `accessibilityState`
- Chart containers: `accessibilityRole` + summary labels
- Onboarding category cards: `accessibilityRole="checkbox"`
- Color picker swatches: accessibility labels
- Section header: `accessibilityRole="header"`
- Search clear button: role + label
- Kanban columns: accessibility labels
- Calendar today indicator for color-blind users
- Decorative elements: `accessibilityElementsHidden`
- ErrorBoundary: dark mode support

### Category 6 -- Dead Code & Config Cleanup
- Delete: `haptic-tab.tsx`, `icon-symbol.tsx`, `icon-symbol.ios.tsx`
- Delete or integrate: `pomodoro-helpers.ts`, `use-theme-color.ts`
- Remove dead store methods: `completeSession`, `setPhase`, `isLoading`
- Remove dead constants: `TAB_BAR_HEIGHT`, `Shadows.glow`, `AnimationDurations` re-export, `XP_VALUES.ACHIEVEMENT_UNLOCK`
- Remove redundant default exports across components
- Remove dead tab icon definitions in `_layout.tsx`
- package.json: remove unused deps (expo-av, expo-image, expo-web-browser)
- package.json: fix version ranges (^ → ~ for Expo SDK 54)
- package.json: fix packageManager field (yarn → npm)
- eas.json: APK → AAB for production
- Add missing Expo plugins (expo-background-fetch, expo-task-manager)
- `console.warn` → `__DEV__` guard in icon.tsx
- Icon style cast → `StyleSheet.flatten`

### Category 7 -- Code Duplication Refactor
- `getCategoryColor` → shared hook `useCategoryLookup()`
- `getPriorityColor` → shared utility `utils/priority.ts`
- `PRIORITIES` array → `constants/priorities.ts`
- `COMPLETION_CHANNELS` → shared constant
- `getPhaseDuration`/`getNextPhase` → single source in `pomodoro-helpers.ts`
- View header → shared `ViewHeader` component
- `colorScheme ?? 'light'` → default inside `useColorScheme` hook
- `Colors[colorScheme ?? 'light']` → `useThemeColors()` hook
- Inline style objects → StyleSheet or useMemo

---

## 5. New Features

### 5.1 Undo (no Redo)
- `stores/undo-store.ts`: stack-based, last 10 actions
- `components/common/undo-snackbar.tsx`: 5s auto-dismiss
- Supported: todo delete, subtask delete, todo status change, category delete
- Snapshot-based: push previous state, restore on undo

### 5.2 Recurring Tasks
- `recurrence_rule` JSONB field on todos: `{type: 'daily'|'weekly'|'monthly', interval: number, daysOfWeek?: number[]}`
- `utils/recurrence.ts`: next due date calculation
- On todo completion: if recurring, auto-create next instance
- UI: recurrence picker in create/edit screens

### 5.3 Pomodoro Detailed Statistics
- New stats section: "Focus Time by Task"
- Horizontal bar chart showing total focus minutes per todo
- 7-day / 30-day filter toggle
- Reuses existing chart components

### 5.4 Test Infrastructure
- Jest + jest-expo + @testing-library/react-native
- `__tests__/stores/` -- store unit tests (target: 80%+ coverage)
- `__tests__/utils/` -- utility tests (target: 90%+ coverage)
- `__tests__/services/sync/` -- sync logic tests
- `package.json` test script added

---

## 6. Execution Order

1. **Phase 1: Config & Foundation** -- dependency fixes, dead code cleanup, package.json fixes
2. **Phase 2: Supabase Infrastructure** -- install deps, DB migrations, RLS policies, auth screens
3. **Phase 3: Store Overhaul** -- rewrite stores with sync support + all Category 1 bug fixes
4. **Phase 4: Sync Service** -- implement sync layer, queue, conflict resolution
5. **Phase 5: Animation & UI Fixes** -- Categories 2 + 3 bug fixes
6. **Phase 6: Notification & Background Fixes** -- Category 4
7. **Phase 7: Accessibility & Refactor** -- Categories 5 + 7
8. **Phase 8: New Features** -- Undo, Recurring Tasks, Pomodoro Stats
9. **Phase 9: Test Infrastructure** -- Jest setup, store tests, utility tests, sync tests
10. **Phase 10: Final Verification** -- End-to-end testing, performance check
