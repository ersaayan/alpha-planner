# Alpha Planner Production Readiness Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical, high, and medium severity bugs identified during production readiness review to make the app stable, crash-free, and ready for App Store / Play Store submission.

**Architecture:** The app is a React Native/Expo (SDK 53) todo + pomodoro timer app using Zustand for state management with AsyncStorage persistence, Reanimated for animations, and expo-notifications for background timer notifications. Fixes target 6 store files, 17 screen/view files, 5 service files, and 23 component files across data integrity, race conditions, notification reliability, animation safety, and build configuration domains.

**Tech Stack:** React Native 0.81, Expo SDK 53, Zustand 5, Reanimated 3, expo-notifications, expo-background-fetch, TypeScript (strict)

---

## Critical Issues Summary (by priority)

| # | Severity | Area | Issue |
|---|----------|------|-------|
| C1 | CRITICAL | eas.json | Production Android build uses `apk` - cannot submit to Play Store |
| C2 | CRITICAL | settings.tsx | `AsyncStorage.clear()` nukes all data including third-party state |
| C3 | CRITICAL | pomodoro-store | Unbounded sync loop with per-iteration `set()` causes UI freeze |
| C4 | CRITICAL | settings-store | `resetAllData` doesn't stop running timer interval |
| C5 | CRITICAL | notification-service | `scheduledTaskDueNotifications` Map not persisted - duplicate notifications |
| C6 | CRITICAL | gamification-store | `toLocaleDateString('en-CA')` not guaranteed YYYY-MM-DD |
| C7 | CRITICAL | todo/[id].tsx | useEffect resets form state on any todo change, destroying edits |
| H1 | HIGH | gamification.ts | `getNextPhase` triggers long break when sessionsCompleted===0 |
| H2 | HIGH | gamification.ts | early_bird/night_owl achievements can never unlock via checkAchievements |
| H3 | HIGH | _layout.tsx | Achievement alerts loop infinitely on Android |
| H4 | HIGH | pomodoro-store | `startTimer` doesn't guard against double-start, loses sessions |
| H5 | HIGH | pomodoro-store | Missing try/catch on `scheduleTimerNotification` in syncTimer |
| H6 | HIGH | pomodoro-task | `cancelScheduledNotificationAsync` not wrapped in try-catch |
| H7 | HIGH | notification-service | `dismissTimerNotification` has no try-catch |
| H8 | HIGH | notification-service | Timer completion notification uses stale permission check |
| H9 | HIGH | todo-store | `deleteSubtask` auto-completes without awarding XP |
| H10 | HIGH | pomodoro-store | `completeSession` gives no gamification credit |
| H11 | HIGH | achievement-unlock | Overlay does not cover full screen |
| M1 | MEDIUM | all stores | No-op `migrate` functions will corrupt data on schema changes |
| M2 | MEDIUM | category-store | Deleted category not cleared from active filter |
| M3 | MEDIUM | todo-store | NaN in sort order after migration with missing `order` field |
| M4 | MEDIUM | pomodoro.tsx | Phase completion badge may never render due to atomic transitions |
| M5 | MEDIUM | category-selection | User can complete onboarding with zero categories |
| M6 | MEDIUM | todo/[id].tsx | Datepicker `min={new Date()}` breaks editing overdue tasks |
| M7 | MEDIUM | notification-service | `checkPermission()` called every second - excessive bridge calls |
| M8 | MEDIUM | error-boundary | "Try Again" re-renders same crashing component |
| M9 | MEDIUM | background-task | No iteration cap on while loop |
| M10 | MEDIUM | gamification.ts | `getXpForNextLevel` returns wrong value at max level |
| M11 | MEDIUM | date.ts callers | No guard against Invalid Date - format() throws RangeError |
| M12 | MEDIUM | pomodoro-helpers | `getPhaseDuration('idle')` silently returns focus duration |
| M13 | MEDIUM | app.json | `reactCompiler: true` is experimental |
| M14 | MEDIUM | pomodoro-store | `stopTimer` does two separate `set()` calls |
| M15 | MEDIUM | _layout.tsx | Notification init has no .catch() - unhandled rejection |

---

## Task 1: Fix Build Configuration (C1, M13)

**Files:**
- Modify: `eas.json:24-26`
- Modify: `app.json:73-76`

**Step 1: Fix eas.json production Android build type**

In `eas.json`, change the production Android buildType from `apk` to `app-bundle`:

```json
"production": {
  "android": {
    "buildType": "app-bundle"
  },
```

**Step 2: Remove experimental reactCompiler**

In `app.json`, remove `reactCompiler` from experiments:

```json
"experiments": {
  "typedRoutes": true
}
```

**Step 3: Commit**

```bash
git add eas.json app.json
git commit -m "fix: use app-bundle for Play Store and remove experimental reactCompiler"
```

---

## Task 2: Fix Date Formatting - Replace toLocaleDateString with date-fns (C6)

**Files:**
- Modify: `stores/gamification-store.ts` (lines 102, 110, 226)
- Modify: `utils/date.ts` (add safe date helper)

**Step 1: Add `getDateKey` helper to utils/date.ts**

Add a deterministic date key function using `date-fns/format`:

```typescript
import { format as fnsFormat } from 'date-fns';

export function getDateKey(date: Date = new Date()): string {
  return fnsFormat(date, 'yyyy-MM-dd');
}
```

**Step 2: Replace all `toLocaleDateString('en-CA')` in gamification-store.ts**

Replace every instance of `new Date().toLocaleDateString('en-CA')` with `getDateKey()`:

```typescript
import { getDateKey } from '@/utils/date';

// Line ~102: in updateStreak
const today = getDateKey();

// Line ~110: yesterday calculation
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = getDateKey(yesterday);

// Line ~226: in updateDailyStats
const today = getDateKey();
```

**Step 3: Add safe date formatting guard to utils/date.ts**

Wrap `format` call to handle Invalid Date:

```typescript
export function formatDate(date: Date, dateFormat: AppSettings['dateFormat']): string {
  if (isNaN(date.getTime())) return '';
  // ... existing switch
}
```

**Step 4: Commit**

```bash
git add utils/date.ts stores/gamification-store.ts
git commit -m "fix: replace toLocaleDateString with date-fns for deterministic date keys"
```

---

## Task 3: Fix Settings Reset - Proper Store Reset (C2, C4)

**Files:**
- Modify: `app/(tabs)/settings.tsx` (lines 54-71)
- Modify: `stores/settings-store.ts` (lines 55-89)
- Modify: `stores/pomodoro-store.ts` (add stopTimer export or _stopTicking access)

**Step 1: Fix settings.tsx to use store's resetAllData instead of raw AsyncStorage.clear**

Replace the `handleResetAllData` in settings.tsx:

```typescript
const handleResetAllData = () => {
  Alert.alert(
    'Reset All Data',
    'This will delete all your tasks, categories, statistics, and settings. This action cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            // Stop any running timer first
            const pomodoroState = usePomodoroStore.getState();
            if (pomodoroState.timer.state === 'running' || pomodoroState.timer.state === 'paused') {
              pomodoroState.stopTimer();
            }
            await resetAllData();
            Alert.alert('Done', 'All data has been reset. Please restart the app.');
          } catch (error) {
            Alert.alert('Error', 'Failed to reset data. Please try again.');
          }
        },
      },
    ],
  );
};
```

**Step 2: Fix settings-store.ts resetAllData to stop timer before reset**

In `resetAllData`, before resetting stores, stop the pomodoro timer:

```typescript
resetAllData: async () => {
  try {
    // Stop any running timer first
    const { stopTimer, timer } = require('@/stores/pomodoro-store').usePomodoroStore.getState();
    if (timer.state === 'running' || timer.state === 'paused') {
      stopTimer();
    }
  } catch (e) {
    // Timer stop is best-effort
  }

  // Then proceed with existing reset logic
  await AsyncStorage.multiRemove([...]);
  // ... rest of reset
}
```

**Step 3: Commit**

```bash
git add app/\(tabs\)/settings.tsx stores/settings-store.ts
git commit -m "fix: use proper store reset instead of raw AsyncStorage.clear, stop timer before reset"
```

---

## Task 4: Fix Pomodoro Sync Loop - Add Iteration Cap and Batch Updates (C3)

**Files:**
- Modify: `stores/pomodoro-store.ts` (syncTimer method, ~lines 331-443)
- Modify: `services/background/background-task.ts` (while loop, ~line 132)

**Step 1: Add iteration cap and batch state updates in pomodoro-store syncTimer**

In the `syncTimer` method, add a max iteration cap and collect all state changes to apply in a single `set()`:

```typescript
syncTimer: () => {
  const { timer, currentSession } = get();
  if (!timer.startedAt || timer.state !== 'running') return;

  const now = Date.now();
  const elapsed = calculateElapsedSeconds(timer, now);

  if (elapsed < timer.remainingTime) {
    // Normal case: timer still running, just update remaining
    set({ timer: { ...timer, remainingTime: timer.remainingTime - elapsed, startedAt: now } });
    return;
  }

  // Phase completion(s) during background - cap at 50 iterations
  const MAX_SYNC_ITERATIONS = 50;
  let iterations = 0;
  let currentTimer = { ...timer };
  let accumulatedSessions = [...get().sessions];
  let accumulatedCurrentSession = currentSession;
  let elapsedSeconds = elapsed;
  let completedPomodoros = 0;

  while (elapsedSeconds >= currentTimer.remainingTime && iterations < MAX_SYNC_ITERATIONS) {
    if (currentTimer.remainingTime <= 0) break;
    iterations++;

    elapsedSeconds -= currentTimer.remainingTime;

    // Track completed focus sessions
    if (currentTimer.phase === 'focus') {
      completedPomodoros++;
      // Complete session
      if (accumulatedCurrentSession) {
        accumulatedSessions = [...accumulatedSessions, {
          ...accumulatedCurrentSession,
          endedAt: new Date().toISOString(),
          wasCompleted: true,
        }];
      }
    }

    // Determine next phase
    const nextPhase = getNextPhase(
      currentTimer.phase,
      currentTimer.sessionsCompleted + (currentTimer.phase === 'focus' ? 1 : 0),
      get().settings || useSettingsStore.getState().pomodoroSettings,
    );

    const nextDuration = getPhaseDuration(nextPhase, useSettingsStore.getState().pomodoroSettings);
    const shouldContinue = currentTimer.phase === 'focus'
      ? useSettingsStore.getState().pomodoroSettings.autoStartBreaks
      : useSettingsStore.getState().pomodoroSettings.autoStartPomodoros;

    if (!shouldContinue) {
      // Stop here - don't auto-continue
      currentTimer = {
        ...currentTimer,
        state: 'stopped' as const,
        phase: nextPhase,
        remainingTime: nextDuration,
        totalTime: nextDuration,
        startedAt: null,
        pausedAt: null,
        sessionsCompleted: currentTimer.sessionsCompleted + (currentTimer.phase === 'focus' ? 1 : 0),
      };
      break;
    }

    // Auto-continue to next phase
    currentTimer = {
      ...currentTimer,
      phase: nextPhase,
      remainingTime: nextDuration - elapsedSeconds,
      totalTime: nextDuration,
      startedAt: now,
      sessionsCompleted: currentTimer.sessionsCompleted + (currentTimer.phase === 'focus' ? 1 : 0),
    };

    // New session for focus phases
    if (nextPhase === 'focus') {
      accumulatedCurrentSession = {
        id: generateId(),
        startedAt: new Date().toISOString(),
        endedAt: null,
        phase: 'focus',
        duration: nextDuration,
        wasCompleted: false,
        todoId: currentSession?.todoId ?? null,
        pomodoroSessions: 0,
      };
    }
  }

  // Single batch state update
  set({
    timer: currentTimer,
    sessions: accumulatedSessions,
    currentSession: accumulatedCurrentSession,
  });

  // Award gamification XP once for all completed pomodoros
  if (completedPomodoros > 0) {
    const gamification = useGamificationStore.getState();
    for (let i = 0; i < completedPomodoros; i++) {
      gamification.incrementPomodoro(getPhaseDuration('focus', useSettingsStore.getState().pomodoroSettings));
    }
  }

  // Restart ticking if still running
  if (currentTimer.state === 'running') {
    get()._startTicking();
  }
}
```

**Step 2: Add iteration cap to background-task.ts while loop**

Add `MAX_ITERATIONS = 50` guard and break after cap:

```typescript
const MAX_ITERATIONS = 50;
let iterations = 0;
while (currentElapsed >= currentTimer.totalTime) {
  if (currentTimer.totalTime <= 0) break;
  if (iterations >= MAX_ITERATIONS) break;
  iterations++;
  // ... rest of loop
}
```

**Step 3: Commit**

```bash
git add stores/pomodoro-store.ts services/background/background-task.ts
git commit -m "fix: cap sync loop iterations and batch state updates to prevent UI freeze"
```

---

## Task 5: Fix Notification Service Reliability (C5, H5, H6, H7, H8, M7, M15)

**Files:**
- Modify: `services/notifications/notification-service.ts`
- Modify: `services/background/pomodoro-task.ts`
- Modify: `stores/pomodoro-store.ts` (syncTimer notification call)
- Modify: `app/_layout.tsx` (notification init)

**Step 1: Persist scheduled task-due notification IDs with AsyncStorage**

In `notification-service.ts`, replace the in-memory Map with AsyncStorage-backed tracking:

```typescript
private static TASK_NOTIFICATION_KEY = 'task-due-notifications';

private async loadScheduledTaskNotifications(): Promise<Map<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(NotificationService.TASK_NOTIFICATION_KEY);
    return raw ? new Map(JSON.parse(raw)) : new Map();
  } catch {
    return new Map();
  }
}

private async saveScheduledTaskNotifications(map: Map<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(
      NotificationService.TASK_NOTIFICATION_KEY,
      JSON.stringify([...map.entries()])
    );
  } catch {
    // best-effort
  }
}
```

Update all methods that use `scheduledTaskDueNotifications` to use these async helpers.

**Step 2: Add try-catch to dismissTimerNotification**

```typescript
async dismissTimerNotification(): Promise<void> {
  this.lastCategoryIsPaused = null;
  try {
    await Notifications.dismissNotificationAsync(TIMER_NOTIFICATION_ID);
  } catch {
    // notification may not exist
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(TIMER_NOTIFICATION_ID);
  } catch {
    // notification may not exist
  }
}
```

**Step 3: Add try-catch to pomodoro-task.ts cancelScheduledNotificationAsync**

```typescript
if (existingId) {
  try {
    await Notifications.cancelScheduledNotificationAsync(existingId);
  } catch {
    // notification may have already fired/expired
  }
}
```

**Step 4: Cache permission check with TTL in notification-service.ts**

```typescript
private permissionCacheTime: number = 0;
private static PERMISSION_CACHE_TTL = 60000; // 1 minute

async checkPermission(): Promise<boolean> {
  const now = Date.now();
  if (this.hasPermission && now - this.permissionCacheTime < NotificationService.PERMISSION_CACHE_TTL) {
    return this.hasPermission;
  }
  const { status } = await Notifications.getPermissionsAsync();
  this.hasPermission = status === 'granted';
  this.permissionCacheTime = now;
  return this.hasPermission;
}
```

Also update `sendTimerCompleteNotification`, `sendPhaseStartNotification`, `sendReminderNotification`, `sendAchievementNotification`, and `scheduleTaskDueNotification` to call `await this.checkPermission()` instead of reading `this.hasPermission` directly.

**Step 5: Add try-catch to syncTimer notification call in pomodoro-store.ts**

```typescript
// In syncTimer, wrap scheduleTimerNotification
try {
  await scheduleTimerNotification(currentTimer.phase, currentTimer.remainingTime);
} catch {
  // notification scheduling is non-critical
}
```

**Step 6: Add .catch() to notification init in _layout.tsx**

```typescript
notificationService.initialize()
  .then((hasPermission) => {
    if (hasPermission) {
      notificationService.setActionCallbacks({ ... });
    }
  })
  .catch((error) => {
    console.warn('Notification initialization failed:', error);
  });
```

**Step 7: Commit**

```bash
git add services/notifications/notification-service.ts services/background/pomodoro-task.ts stores/pomodoro-store.ts app/_layout.tsx
git commit -m "fix: persist notification IDs, add error handling, cache permission checks"
```

---

## Task 6: Fix Todo Edit Screen Race Condition (C7, M6)

**Files:**
- Modify: `app/todo/[id].tsx` (lines 65-83, 260)

**Step 1: Guard useEffect to not reset form when editing**

```typescript
useEffect(() => {
  if (!todo) return;
  // Don't reset form if user is currently editing
  if (isEditing) return;

  setTitle(todo.title);
  setDescription(todo.description);
  setDueDate(todo.dueDate ? new Date(todo.dueDate) : null);
  setSelectedCategoryId(todo.categoryId);
  setPriority(todo.priority);
  setEstimatedPomodoros(todo.estimatedPomodoros);
}, [todo?.id, todo?.updatedAt, isEditing, categories]);
```

Note: Changed dependency from `todo` (object reference) to `todo?.id` and `todo?.updatedAt` to prevent unnecessary re-runs.

**Step 2: Fix Datepicker min date for overdue tasks**

```typescript
<Datepicker
  date={dueDate}
  onSelect={setDueDate}
  min={dueDate && dueDate < new Date() ? dueDate : new Date()}
  // ...
/>
```

**Step 3: Commit**

```bash
git add app/todo/\[id\].tsx
git commit -m "fix: prevent form reset during editing and allow viewing past due dates"
```

---

## Task 7: Fix getNextPhase Long Break Logic (H1)

**Files:**
- Modify: `constants/gamification.ts` (getNextPhase, line 23-34)
- Modify: `stores/pomodoro-store.ts` (getNextPhase, line ~32)
- Modify: `services/background/background-task.ts` (getNextPhase, line ~36)

**Step 1: Fix the modulo-zero bug in all three locations**

The fix is the same in all three files - add a guard for `sessionsCompleted === 0`:

```typescript
function getNextPhase(
  phase: PomodoroPhase,
  sessionsCompleted: number,
  settings: PomodoroSettings,
): PomodoroPhase {
  if (phase === 'focus') {
    return (sessionsCompleted > 0 && sessionsCompleted % settings.sessionsUntilLongBreak === 0)
      ? 'long_break'
      : 'short_break';
  }
  return 'focus';
}
```

**Step 2: Commit**

```bash
git add constants/gamification.ts stores/pomodoro-store.ts services/background/background-task.ts
git commit -m "fix: prevent long break trigger when sessionsCompleted is 0"
```

---

## Task 8: Fix Achievement System (H2, M10)

**Files:**
- Modify: `types/gamification.types.ts` (line 11)
- Modify: `stores/gamification-store.ts` (checkAchievements, incrementPomodoro)
- Modify: `constants/gamification.ts` (getXpForNextLevel)

**Step 1: Type the requirement.type as a discriminated union**

```typescript
requirement: {
  type: 'pomodoro_count' | 'task_count' | 'streak_days' | 'focus_time' | 'early_pomodoro' | 'late_pomodoro';
  value: number;
};
```

**Step 2: Add early_bird / night_owl unlock logic to incrementPomodoro**

In `gamification-store.ts`, inside `incrementPomodoro`, add time-based achievement checks:

```typescript
incrementPomodoro: (focusDuration: number) => {
  // ... existing logic ...

  // Check time-based achievements
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 8) {
    // Early bird: completed a pomodoro before 8 AM
    const earlyBird = ACHIEVEMENTS.find(a => a.requirement.type === 'early_pomodoro');
    if (earlyBird && !get().unlockedAchievements.some(u => u.id === earlyBird.id)) {
      get().unlockAchievement(earlyBird.id);
    }
  }
  if (hour >= 22 || hour < 4) {
    // Night owl: completed a pomodoro after 10 PM
    const nightOwl = ACHIEVEMENTS.find(a => a.requirement.type === 'late_pomodoro');
    if (nightOwl && !get().unlockedAchievements.some(u => u.id === nightOwl.id)) {
      get().unlockAchievement(nightOwl.id);
    }
  }
}
```

**Step 3: Fix getXpForNextLevel at max level**

```typescript
export function getXpForNextLevel(level: number): number {
  const nextLevel = LEVELS.find((l) => l.level === level + 1);
  if (!nextLevel) return Infinity; // Max level reached
  return nextLevel.xpRequired;
}
```

**Step 4: Commit**

```bash
git add types/gamification.types.ts stores/gamification-store.ts constants/gamification.ts
git commit -m "fix: type achievement requirements, enable time-based achievements, fix max level XP"
```

---

## Task 9: Fix Android Achievement Alert Loop (H3)

**Files:**
- Modify: `app/_layout.tsx` (lines 211-220)

**Step 1: Replace Alert.alert with a queue-based single-alert system**

```typescript
// Replace the useEffect for achievement notifications
const [currentAchievement, setCurrentAchievement] = useState<string | null>(null);

useEffect(() => {
  if (pendingNotifications.length > 0 && !currentAchievement) {
    const next = pendingNotifications[0];
    setCurrentAchievement(next.id);

    Alert.alert(
      next.title || 'Achievement Unlocked!',
      next.message,
      [{
        text: 'OK',
        onPress: () => {
          dismissNotification(next.id);
          setCurrentAchievement(null);
        },
      }],
      { cancelable: false }
    );
  }
}, [pendingNotifications, currentAchievement]);
```

**Step 2: Commit**

```bash
git add app/_layout.tsx
git commit -m "fix: queue achievement alerts to prevent infinite loop on Android"
```

---

## Task 10: Fix Pomodoro Store Guard Rails (H4, H10, M14)

**Files:**
- Modify: `stores/pomodoro-store.ts`

**Step 1: Add running guard to startTimer**

At the top of `startTimer`:

```typescript
startTimer: (todoId?: string) => {
  const { timer } = get();
  // Prevent double-start
  if (timer.state === 'running') return;
  // ... rest of startTimer
}
```

**Step 2: Add gamification credit to completeSession**

```typescript
completeSession: () => {
  const { currentSession, timer } = get();
  if (!currentSession) return;

  // Award gamification if it was a focus session
  if (timer.phase === 'focus') {
    const gamification = useGamificationStore.getState();
    gamification.incrementPomodoro(timer.totalTime);

    if (currentSession.todoId) {
      const todoStore = useTodoStore.getState();
      todoStore.incrementPomodoroCount(currentSession.todoId);
    }
  }

  // ... rest of existing completeSession logic
}
```

**Step 3: Merge stopTimer into a single set() call**

Replace the two separate `set()` calls with one:

```typescript
stopTimer: () => {
  // ... compute all values ...

  set({
    sessions: updatedSessions,
    currentSession: null,
    timer: {
      ...timer,
      state: 'stopped',
      remainingTime: timer.totalTime,
      startedAt: null,
      pausedAt: null,
    },
  });
}
```

**Step 4: Commit**

```bash
git add stores/pomodoro-store.ts
git commit -m "fix: guard double-start, add gamification to completeSession, merge stopTimer set calls"
```

---

## Task 11: Fix Todo Store Data Integrity (H9, M2, M3)

**Files:**
- Modify: `stores/todo-store.ts`
- Modify: `stores/category-store.ts`

**Step 1: Award XP on deleteSubtask auto-completion**

In `deleteSubtask`, after auto-completion:

```typescript
// After setting status to completed via auto-completion
if (allRemainingCompleted && filteredSubtasks.length > 0) {
  // Award gamification credit
  useGamificationStore.getState().incrementTaskCompleted();
}
```

**Step 2: Clear active filter when category is deleted**

In `category-store.ts` `deleteCategory`:

```typescript
deleteCategory: (id: string) => {
  // ... existing cleanup ...

  // Clear todo filter if filtering by deleted category
  const todoState = useTodoStore.getState();
  if (todoState.filter?.categoryId === id) {
    useTodoStore.setState({
      filter: { ...todoState.filter, categoryId: undefined },
    });
  }
}
```

**Step 3: Add safe migrate with order field default**

In `todo-store.ts` migrate function:

```typescript
migrate: (persistedState: unknown, version: number) => {
  const state = persistedState as any;
  // Ensure all todos have an order field
  if (state?.todos) {
    state.todos = state.todos.map((todo: any, index: number) => ({
      ...todo,
      order: todo.order ?? index,
      subtasks: (todo.subtasks || []).map((st: any, si: number) => ({
        ...st,
        order: st.order ?? si,
      })),
    }));
  }
  return state as TodoState;
}
```

**Step 4: Commit**

```bash
git add stores/todo-store.ts stores/category-store.ts
git commit -m "fix: award XP on subtask-delete completion, clear filter on category delete, safe migrate"
```

---

## Task 12: Fix Store Migration Safety (M1)

**Files:**
- Modify: `stores/gamification-store.ts` (migrate)
- Modify: `stores/settings-store.ts` (migrate)
- Modify: `stores/category-store.ts` (migrate)
- Modify: `stores/pomodoro-store.ts` (migrate)

**Step 1: Add defensive migration to gamification-store**

```typescript
migrate: (persistedState: unknown, version: number) => {
  const state = persistedState as any;
  const defaults = {
    stats: { ...INITIAL_USER_STATS },
    unlockedAchievements: [],
    pendingNotifications: [],
    dailyStats: { date: '', pomodorosCompleted: 0, tasksCompleted: 0, focusMinutes: 0 },
  };
  return {
    ...defaults,
    ...state,
    stats: { ...defaults.stats, ...(state?.stats || {}) },
    dailyStats: { ...defaults.dailyStats, ...(state?.dailyStats || {}) },
  } as GamificationState;
}
```

**Step 2: Add defensive migration to settings-store**

```typescript
migrate: (persistedState: unknown, version: number) => {
  const state = persistedState as any;
  return {
    settings: { ...DEFAULT_SETTINGS, ...(state?.settings || {}) },
    pomodoroSettings: { ...DEFAULT_POMODORO_SETTINGS, ...(state?.pomodoroSettings || {}) },
  } as SettingsState;
}
```

**Step 3: Add defensive migration to category-store**

```typescript
migrate: (persistedState: unknown, version: number) => {
  const state = persistedState as any;
  return {
    categories: state?.categories || [],
    initialized: state?.initialized ?? false,
  } as CategoryState;
}
```

**Step 4: Add defensive migration to pomodoro-store**

```typescript
migrate: (persistedState: unknown, version: number) => {
  const state = persistedState as any;
  const defaultTimer = { /* default timer state */ };
  return {
    timer: { ...defaultTimer, ...(state?.timer || {}) },
    sessions: state?.sessions || [],
    currentSession: state?.currentSession || null,
  } as PomodoroState;
}
```

**Step 5: Commit**

```bash
git add stores/gamification-store.ts stores/settings-store.ts stores/category-store.ts stores/pomodoro-store.ts
git commit -m "fix: add defensive migrations to all stores for safe schema evolution"
```

---

## Task 13: Fix Onboarding and UX Guards (M5, M8)

**Files:**
- Modify: `app/(onboarding)/category-selection.tsx`
- Modify: `components/error-boundary.tsx`

**Step 1: Require at least one category in onboarding**

```typescript
const handleFinish = () => {
  if (selectedCategories.length === 0) {
    Alert.alert('Select Categories', 'Please select at least one category to continue.');
    return;
  }
  keepOnlyCategories(selectedCategories);
  completeOnboarding();
  router.replace('/(tabs)');
};
```

**Step 2: Add retry limit to error boundary**

```typescript
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, retryCount: 0 };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleReload = () => {
    if (this.state.retryCount >= 2) {
      // After 2 retries, suggest app restart
      Alert.alert('Persistent Error', 'Please close and reopen the app.');
      return;
    }
    this.setState((prev) => ({ hasError: false, retryCount: prev.retryCount + 1 }));
  };
  // ...
}
```

**Step 3: Commit**

```bash
git add app/\(onboarding\)/category-selection.tsx components/error-boundary.tsx
git commit -m "fix: require at least one category in onboarding, add error boundary retry limit"
```

---

## Task 14: Fix Achievement Unlock Overlay (H11)

**Files:**
- Modify: `components/gamification/achievement-unlock.tsx` (overlay style)

**Step 1: Fix overlay to cover full screen**

```typescript
overlay: {
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0,0,0,0.3)',
  zIndex: 1000,
},
```

**Step 2: Commit**

```bash
git add components/gamification/achievement-unlock.tsx
git commit -m "fix: achievement overlay covers full screen to prevent background interaction"
```

---

## Task 15: Fix Pomodoro Phase Completion Detection (M4)

**Files:**
- Modify: `app/(tabs)/pomodoro.tsx` (lines 94-117)

**Step 1: Track phase changes instead of remainingTime === 0**

Replace the completion detection with phase transition tracking:

```typescript
const prevPhaseRef = useRef(timerPhase);
const prevTimerStateRef = useRef(timerState);

useEffect(() => {
  const phaseChanged = prevPhaseRef.current !== timerPhase;
  const wasRunning = prevTimerStateRef.current === 'running';

  if (phaseChanged && wasRunning) {
    // Phase transition detected
    const completedPhase = prevPhaseRef.current;
    if (completedPhase === 'focus') {
      // Focus phase completed
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility("Time's up! Take a break.");
      }
    } else {
      // Break completed
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility("Break's over! Ready to focus.");
      }
    }
  }

  prevPhaseRef.current = timerPhase;
  prevTimerStateRef.current = timerState;
}, [timerPhase, timerState]);
```

**Step 2: Commit**

```bash
git add app/\(tabs\)/pomodoro.tsx
git commit -m "fix: detect phase completion via phase transition instead of remainingTime check"
```

---

## Task 16: Fix getPhaseDuration for idle phase (M12)

**Files:**
- Modify: `utils/pomodoro-helpers.ts` (line 19)

**Step 1: Return 0 for idle phase**

```typescript
export function getPhaseDuration(
  phase: PomodoroPhase,
  settings: PomodoroSettings,
): number {
  if (phase === 'focus') return settings.focusDuration;
  if (phase === 'short_break') return settings.shortBreakDuration;
  if (phase === 'long_break') return settings.longBreakDuration;
  return 0; // idle phase has no duration
}
```

**Step 2: Commit**

```bash
git add utils/pomodoro-helpers.ts
git commit -m "fix: return 0 for idle phase duration instead of focus duration"
```

---

## Execution Notes

- Tasks 1-2 are configuration/utility fixes with zero risk - start here.
- Tasks 3-6 are the most critical runtime fixes.
- Tasks 7-11 fix data integrity and gamification logic.
- Tasks 12-16 are defensive improvements.
- Each task is independent and can be executed in any order.
- After all tasks, do a full TypeScript compile check: `npx tsc --noEmit`
- Test on both iOS and Android simulators with focus on:
  - Timer background/foreground transitions
  - Data reset flow
  - Achievement unlock flow
  - Onboarding flow
  - Todo edit while timer is running
