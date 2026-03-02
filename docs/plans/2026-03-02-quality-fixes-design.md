# Alpha Planner Quality Fixes Design

**Date:** 2026-03-02
**Scope:** 11 fixes (H1-H3, M1-M3, M5-M6, L1-L3), excluding C1 and M4

## High Priority

### H1 - Idempotent Timer Interval Management
**File:** `stores/pomodoro-store.ts`
**Problem:** Global `timerInterval` and `autoStartTimeout` can cause issues in React Strict Mode.
**Fix:** Make `_startTicking`/`_stopTicking` idempotent - always clear existing interval before creating new one. Add guard checks.

### H2 - Enable Time-Based Achievement Unlocking
**File:** `stores/gamification-store.ts`
**Problem:** `early_bird` and `night_owl` achievements unreachable via `checkAchievements()`.
**Fix:** Add hour check in `incrementPomodoro()` - before 7 AM unlocks early_bird, after 11 PM unlocks night_owl.

### H3 - Replace Dynamic Requires with Direct Imports
**File:** `stores/settings-store.ts`
**Problem:** `resetAllData()` uses fragile `require()` calls.
**Fix:** Use direct imports with `getState()`. Zustand stores are functions so circular deps are not an issue.

## Medium Priority

### M1 - Optimize getFilteredTodos
**File:** `stores/todo-store.ts`
**Problem:** No early exit or optimization in filtering.
**Fix:** Add early return for empty todos/no filters. Component-side memoization is the correct approach.

### M2 - Skip Already Unlocked Achievements
**File:** `stores/gamification-store.ts`
**Problem:** `checkAchievements()` checks already-unlocked achievements.
**Fix:** Add `isAchievementUnlocked` guard at loop start.

### M3 - Centralize Category Color Fallback
**File:** `stores/category-store.ts`
**Problem:** Hardcoded `#90AB8B` sage color.
**Fix:** Import and use `Palette.sage` from theme constants.

### M5 - Project-Specific README
**File:** `README.md`
**Fix:** Write README with features, tech stack, setup instructions.

### M6 - Extract Repeated UI Patterns
**Files:** `app/(tabs)/*.tsx`, new `components/common/`
**Fix:** Extract `SectionHeader`, `StatCard`, `EmptyState` as shared components.

## Low Priority

### L1 - Split Icon Map by Category
**File:** `components/icon.tsx`
**Fix:** Split 198-icon map into categorized sub-maps, merge with spread.

### L2 - Add Chart Entering Animations
**Files:** `components/charts/weekly-chart.tsx`, `components/charts/distribution-chart.tsx`
**Fix:** Add Reanimated entering animations to bar/segment elements.

### L3 - Verify Onboarding Navigation Guard
**Files:** `app/(onboarding)/category-selection.tsx`, `app/index.tsx`
**Fix:** Ensure `router.replace` is used after onboarding completion to prevent back navigation.
