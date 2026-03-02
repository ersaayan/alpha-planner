# Alpha Planner Quality Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 11 identified quality issues (H1-H3, M1-M3, M5-M6, L1-L3) to improve code robustness, maintainability, and polish.

**Architecture:** Direct edits to existing store, component, and screen files. Extract shared UI components into `components/common/`. No new dependencies needed.

**Tech Stack:** TypeScript, Zustand, React Native Reanimated, Expo Router

---

### Task 1: H1 - Make timer interval management idempotent

**Files:**
- Modify: `stores/pomodoro-store.ts:14-17` (global vars) and `:85-108` (_startTicking/_stopTicking)

**Step 1: Add idempotent guards to _startTicking and _stopTicking**

In `stores/pomodoro-store.ts`, the `_startTicking` already clears before creating (lines 87-90). The issue is `autoStartTimeout` set at line 624 doesn't always clear first. Fix: make the global variable management more robust by ensuring `_stopTicking` is always called before `_startTicking` in `syncTimer`.

At line 459-461 in `syncTimer`, the `_startTicking()` is called without first calling `_stopTicking()`. Fix:

```typescript
// Line 459: Replace get()._startTicking() with:
if (get().timer.state === 'running') {
  get()._stopTicking();
  get()._startTicking();
}
```

Also add a comment to the global vars to clarify their lifecycle:

```typescript
// Global interval reference - outside React lifecycle.
// Managed exclusively by _startTicking/_stopTicking. Always idempotent.
let timerInterval: ReturnType<typeof setInterval> | null = null;
let autoStartTimeout: ReturnType<typeof setTimeout> | null = null;
```

**Step 2: Verify no other _startTicking calls bypass _stopTicking**

Review all `_startTicking()` calls:
- Line 164 (startTimer): State set first, then _startTicking. OK - startTimer already calls _stopTicking via autoStartTimeout cleanup.
- Line 230 (resumeTimer): State set first, then _startTicking. OK - previous pauseTimer called _stopTicking.
- Line 460 (syncTimer): Fixed above.

**Step 3: Commit**

```
fix(H1): make timer interval management idempotent in syncTimer
```

---

### Task 2: H2 - Time-based achievements already work, verify and document

**Files:**
- Verify: `stores/gamification-store.ts:80-86`

**Step 1: Verify existing implementation**

Looking at the code, `incrementPomodoro` at lines 80-86 already checks hours:
```typescript
const hour = completionDate.getHours();
if (hour < 7) {
  get().unlockAchievement('early_bird');
}
if (hour >= 23) {
  get().unlockAchievement('night_owl');
}
```

This was fixed in the previous production readiness session. H2 is already resolved. Skip.

---

### Task 3: H3 - Replace dynamic requires with direct imports in resetAllData

**Files:**
- Modify: `stores/settings-store.ts:1-6` (imports) and `:55-101` (resetAllData)

**Step 1: Add direct imports at the top of the file**

Replace the require() calls with direct imports. Zustand stores export hook functions, and accessing them via `.getState()` / `.setState()` does NOT trigger React hooks, so circular imports are safe.

Add these imports after line 5:

```typescript
import { usePomodoroStore } from './pomodoro-store';
import { useTodoStore } from './todo-store';
import { useCategoryStore } from './category-store';
import { useGamificationStore } from './gamification-store';
```

**Step 2: Rewrite resetAllData to use direct imports**

Replace the entire `resetAllData` method:

```typescript
resetAllData: async () => {
  // Stop any running timer first to prevent ghost interval
  try {
    const pomodoroState = usePomodoroStore.getState();
    if (pomodoroState.timer.state === 'running' || pomodoroState.timer.state === 'paused') {
      pomodoroState.stopTimer();
    }
  } catch {
    // Timer stop is best-effort
  }

  // Clear all persisted stores
  await AsyncStorage.multiRemove([
    'settings-storage',
    'pomodoro-storage',
    'todo-storage',
    'category-storage',
    'gamification-storage',
  ]);

  // Reset this store's state
  set({
    settings: DEFAULT_APP_SETTINGS,
    pomodoroSettings: DEFAULT_POMODORO_SETTINGS,
  });

  // Reset other stores via their zustand APIs
  usePomodoroStore.setState({
    timer: INITIAL_TIMER_STATE,
    sessions: [],
    currentSession: null,
  });
  useTodoStore.setState({ todos: [], filter: {} });
  useCategoryStore.setState({ categories: [], isInitialized: false });
  useGamificationStore.setState({
    stats: INITIAL_USER_STATS,
    unlockedAchievements: [],
    dailyStats: [],
    pendingNotifications: [],
  });
},
```

**Step 3: Commit**

```
fix(H3): replace dynamic requires with direct imports in resetAllData
```

---

### Task 4: M1 - Add early return optimization to getFilteredTodos

**Files:**
- Modify: `stores/todo-store.ts:270-303`

**Step 1: Add early return for empty state**

Replace the `getFilteredTodos` method:

```typescript
getFilteredTodos: () => {
  const { todos, filter } = get();

  // Early return if no todos
  if (todos.length === 0) return [];

  // Early return if no filters applied - just sort
  const hasFilter = filter.status?.length ||
    filter.categoryId ||
    filter.priority?.length ||
    filter.search ||
    filter.dueDateRange;

  if (!hasFilter) {
    return [...todos].sort((a, b) => a.order - b.order);
  }

  return todos
    .filter((todo) => {
      if (filter.status?.length && !filter.status.includes(todo.status)) {
        return false;
      }
      if (filter.categoryId && todo.categoryId !== filter.categoryId) {
        return false;
      }
      if (filter.priority?.length && !filter.priority.includes(todo.priority)) {
        return false;
      }
      if (filter.search) {
        const search = filter.search.toLowerCase();
        if (
          !todo.title.toLowerCase().includes(search) &&
          !todo.description?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (filter.dueDateRange) {
        if (!todo.dueDate) return false;
        const dueDate = new Date(todo.dueDate);
        const start = new Date(filter.dueDateRange.start);
        const end = new Date(filter.dueDateRange.end);
        if (dueDate < start || dueDate > end) return false;
      }
      return true;
    })
    .sort((a, b) => a.order - b.order);
},
```

**Step 2: Commit**

```
perf(M1): add early return optimization to getFilteredTodos
```

---

### Task 5: M2 - checkAchievements already skips unlocked (verify)

**Files:**
- Verify: `stores/gamification-store.ts:137-165`

**Step 1: Verify existing implementation**

Looking at line 143: `if (unlockedIds.has(achievement.id)) continue;`

This already skips unlocked achievements. M2 is already resolved. Skip.

---

### Task 6: M3 - Centralize category color fallback

**Files:**
- Modify: `stores/category-store.ts:1` (imports) and `:127-131` (getCategoryColor)

**Step 1: Import Palette from theme constants**

Add `Palette` import at line 1 area:

```typescript
import { Palette } from '@/constants/theme';
```

**Step 2: Replace hardcoded color with Palette.sage**

Replace the `getCategoryColor` method:

```typescript
getCategoryColor: (id) => {
  if (!id) return Palette.sage;
  const category = get().categories.find((c) => c.id === id);
  return category?.color ?? Palette.sage;
},
```

**Step 3: Commit**

```
refactor(M3): use Palette.sage constant for category color fallback
```

---

### Task 7: M5 - Write project-specific README

**Files:**
- Modify: `README.md`

**Step 1: Replace README content**

```markdown
# Alpha Planner

A productivity app combining Pomodoro timer, task management, and gamification. Built with React Native and Expo.

## Features

- **Pomodoro Timer** — Customizable focus/break sessions with background support and notifications
- **Task Management** — Create, organize, and track tasks with subtasks, priorities, and categories
- **4 Task Views** — List, Kanban board, Calendar, and Timeline
- **Gamification** — XP system, 10 levels, 24 achievements, and daily streaks
- **Dark Mode** — Full light/dark/system theme support

## Tech Stack

- React Native 0.81 / Expo SDK 54
- TypeScript (strict)
- Zustand for state management
- React Native Reanimated for animations
- UI Kitten (Eva Design System)

## Getting Started

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Start development server:
   ```bash
   yarn start
   ```

3. Run on device/simulator:
   ```bash
   yarn android   # Android
   yarn ios       # iOS
   ```

## Project Structure

```
app/            # Screens and navigation (Expo Router)
components/     # Reusable UI components
stores/         # Zustand state management
services/       # Background tasks and notifications
constants/      # Theme, animations, gamification config
types/          # TypeScript type definitions
utils/          # Helper functions
hooks/          # Custom React hooks
```

## Build

```bash
eas build --platform android --profile preview
eas build --platform ios --profile preview
```
```

**Step 2: Commit**

```
docs(M5): replace default Expo README with project-specific content
```

---

### Task 8: M6 - Extract shared SectionHeader and EmptyState components

**Files:**
- Create: `components/common/section-header.tsx`
- Create: `components/common/empty-state.tsx`
- Create: `components/common/index.ts`
- Modify: `app/(tabs)/index.tsx` — use SectionHeader
- Modify: `app/(tabs)/stats.tsx` — use SectionHeader
- Modify: `app/todo/[id].tsx` — use SectionHeader
- Modify: `app/(tabs)/todos.tsx` — use EmptyState
- Modify: `app/views/calendar.tsx` — use EmptyState
- Modify: `app/views/timeline.tsx` — use EmptyState

**Step 1: Create SectionHeader component**

Create `components/common/section-header.tsx`:

```typescript
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from '@ui-kitten/components';
import { Spacing } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function SectionHeader({ title, action, style }: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <Text category="h6">{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
});
```

**Step 2: Create EmptyState component**

Create `components/common/empty-state.tsx`:

```typescript
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function EmptyState({ icon, title, subtitle, action, style }: EmptyStateProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, style]}>
      {icon && (
        <Icon name={icon} fill={colors.textMuted} size={48} style={styles.icon} />
      )}
      <Text category="s1" style={{ color: colors.textMuted, textAlign: 'center' }}>
        {title}
      </Text>
      {subtitle && (
        <Text category="c1" style={{ color: colors.textMuted, textAlign: 'center', marginTop: Spacing.xs }}>
          {subtitle}
        </Text>
      )}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  icon: {
    marginBottom: Spacing.md,
  },
  action: {
    marginTop: Spacing.md,
  },
});
```

**Step 3: Create barrel export**

Create `components/common/index.ts`:

```typescript
export { SectionHeader } from './section-header';
export { EmptyState } from './empty-state';
```

**Step 4: Replace sectionHeader in `app/(tabs)/index.tsx`**

Find the sectionHeader pattern at line 229 and line 555 and replace usages with `<SectionHeader>`. Add import: `import { SectionHeader } from '@/components/common';`

Replace inline View+Text blocks like:
```tsx
<View style={styles.sectionHeader}>
  <Text category="h6">Active Tasks</Text>
  ...
</View>
```
with:
```tsx
<SectionHeader title="Active Tasks" action={...} />
```

Remove the `sectionHeader` style from that file's StyleSheet.

**Step 5: Repeat for `app/(tabs)/stats.tsx` and `app/todo/[id].tsx`**

Same pattern: import SectionHeader, replace inline View+Text section headers, remove duplicate styles.

**Step 6: Replace emptyState in `app/(tabs)/todos.tsx`**

Find the empty state pattern at line 255. Add import: `import { EmptyState } from '@/components/common';`

Replace inline View+Icon+Text with:
```tsx
<EmptyState
  icon="clipboard-outline"
  title="No tasks found"
  subtitle="Try adjusting your filters or create a new task"
/>
```

Remove the `emptyState` style from that file's StyleSheet.

**Step 7: Repeat for `app/views/calendar.tsx` and `app/views/timeline.tsx`**

Same pattern for empty states.

**Step 8: Commit**

```
refactor(M6): extract SectionHeader and EmptyState as shared components
```

---

### Task 9: L1 - Split icon map into categorized sub-maps

**Files:**
- Modify: `components/icon.tsx:5-198`

**Step 1: Split the ICON_MAP into categorized sub-maps**

Replace the single large `ICON_MAP` object with categorized sub-maps merged via spread:

```typescript
type IconEntry = { pack: 'feather' | 'material'; name: string };

const NAVIGATION_ICONS: Record<string, IconEntry> = {
  'home': { pack: 'feather', name: 'home' },
  'home-outline': { pack: 'feather', name: 'home' },
  // ... all navigation icons from lines 7-60
};

const ACTION_ICONS: Record<string, IconEntry> = {
  'edit': { pack: 'feather', name: 'edit-2' },
  // ... all action icons from lines 62-86
};

const MEDIA_ICONS: Record<string, IconEntry> = {
  'play': { pack: 'feather', name: 'play' },
  // ... all media icons from lines 88-106
};

const CATEGORY_ICONS: Record<string, IconEntry> = {
  'folder-outline': { pack: 'feather', name: 'folder' },
  // ... all category/folder icons from lines 108-117
};

const TIME_ICONS: Record<string, IconEntry> = {
  'calendar': { pack: 'feather', name: 'calendar' },
  // ... all time/calendar icons from lines 119-130
};

const STATUS_ICONS: Record<string, IconEntry> = {
  'info': { pack: 'feather', name: 'info' },
  // ... all status/info icons from lines 132-142
};

const PEOPLE_ICONS: Record<string, IconEntry> = {
  'person': { pack: 'feather', name: 'user' },
  // ... all people/social icons from lines 144-156
};

const MISC_ICONS: Record<string, IconEntry> = {
  'flash': { pack: 'feather', name: 'zap' },
  // ... all misc icons from lines 158-186
};

const MATERIAL_ICONS: Record<string, IconEntry> = {
  'timer-outline': { pack: 'material', name: 'timer-outline' },
  // ... all material icons from lines 188-198
};

const ICON_MAP: Record<string, IconEntry> = {
  ...NAVIGATION_ICONS,
  ...ACTION_ICONS,
  ...MEDIA_ICONS,
  ...CATEGORY_ICONS,
  ...TIME_ICONS,
  ...STATUS_ICONS,
  ...PEOPLE_ICONS,
  ...MISC_ICONS,
  ...MATERIAL_ICONS,
};
```

Keep all existing entries exactly the same - just organize them. The `Icon` component function stays unchanged.

**Step 2: Commit**

```
refactor(L1): organize icon map into categorized sub-maps
```

---

### Task 10: L2 - Add entering animations to chart bars

**Files:**
- Modify: `components/charts/weekly-chart.tsx`
- Modify: `components/charts/distribution-chart.tsx`

**Step 1: Add Reanimated entering animation to WeeklyChart bars**

In `components/charts/weekly-chart.tsx`:

Add import:
```typescript
import Animated, { FadeInUp } from 'react-native-reanimated';
```

Replace the `<View` for each bar (line 70-81) with `<Animated.View` and add entering animation:

```tsx
<Animated.View
  entering={FadeInUp.delay(index * 80).duration(400)}
  accessible={true}
  accessibilityLabel={`${format(day.date, 'EEEE')}: ${day.value} ${valueLabel}`}
  style={[
    styles.bar,
    {
      height: `${Math.max((day.value / maxValue) * 100, 5)}%`,
      backgroundColor: day.value > 0 ? chartBarColor : colors.border,
      opacity: day.isToday ? 1 : 0.7,
    },
  ]}
/>
```

**Step 2: Add Reanimated entering animation to DistributionChart segments**

In `components/charts/distribution-chart.tsx`:

Add import:
```typescript
import Animated, { FadeIn } from 'react-native-reanimated';
```

Replace the segment `<View` (line 70-85) with `<Animated.View`:

```tsx
<Animated.View
  key={item.originalIndex}
  entering={FadeIn.delay(visibleIndex * 100).duration(300)}
  accessible={true}
  accessibilityLabel={`${item.label}: ${format(item.value)}, ${Math.round(percentage)}%`}
  style={[...same styles...]}
/>
```

**Step 3: Commit**

```
feat(L2): add entering animations to chart components
```

---

### Task 11: L3 - Verify onboarding navigation uses router.replace

**Files:**
- Verify: `app/(onboarding)/category-selection.tsx:60`
- Verify: `app/index.tsx:19,22`

**Step 1: Check existing implementation**

At `category-selection.tsx:60`: `router.replace('/(tabs)');` - Uses `replace`. Correct.
At `app/index.tsx:19`: `<Redirect href="/(onboarding)/welcome" />` - Expo Router's Redirect replaces. Correct.
At `app/index.tsx:22`: `<Redirect href="/(tabs)" />` - Same. Correct.

L3 is already correctly implemented. The `router.replace` prevents back navigation to onboarding. Skip.

---

## Summary

| Task | ID | Action | Status |
|------|----|--------|--------|
| 1 | H1 | Idempotent timer sync | Fix syncTimer |
| 2 | H2 | Time-based achievements | Already fixed |
| 3 | H3 | Replace dynamic requires | Rewrite imports |
| 4 | M1 | Optimize getFilteredTodos | Add early return |
| 5 | M2 | Skip unlocked achievements | Already fixed |
| 6 | M3 | Centralize category color | Use Palette.sage |
| 7 | M5 | Project README | Full rewrite |
| 8 | M6 | Extract shared components | SectionHeader + EmptyState |
| 9 | L1 | Split icon map | Categorize sub-maps |
| 10 | L2 | Chart animations | Add entering animations |
| 11 | L3 | Onboarding navigation | Already correct |

**Actual changes needed: 7 tasks (H1, H3, M1, M3, M5, M6, L1, L2)**
**Already resolved: 3 tasks (H2, M2, L3)**
