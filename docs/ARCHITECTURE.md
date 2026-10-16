# Architecture

A short, factual map of how Alpha Planner is put together. It describes the model, not line-level details; the code is the source of truth.

## Overview

Alpha Planner is an [Expo](https://expo.dev) / React Native app written in TypeScript. Screens live in `app/` (Expo Router), UI state lives in [Zustand](https://zustand.docs.pmnd.rs/) stores that persist themselves to AsyncStorage, and a small set of services wraps platform features (notifications, background work, i18n, optional sync).

The app is **local-first**: it works with no account and no network. Everything below the "Optional sync" section runs entirely on the device.

## Folders

| Folder | Contents |
|--------|----------|
| `app/` | Screens and navigation. File-based routes for Expo Router: tabs (dashboard, Pomodoro, tasks, stats, settings), onboarding, task create/detail, and the kanban / calendar / timeline views. |
| `components/` | Reusable UI: animated primitives, charts, gamification modals and toasts, the circular timer, navigation. |
| `constants/` | Static configuration: theme and Eva theme, animations, XP values, levels, achievements, daily quests, weekly goals, combo multipliers, defaults. |
| `hooks/` | Small React hooks (color scheme, theme colors, sync trigger). |
| `locales/` | `en.json` and `tr.json` translation files. |
| `services/` | Non-UI logic: `notifications/`, `background/`, `gamification/` (daily summary, monthly prestige), `i18n/`, and the optional `supabase/` + `sync/`. |
| `stores/` | Zustand stores (see below). |
| `types/` | Shared TypeScript types. |
| `utils/` | Pure helpers (dates, validators, ids, timer maths, theme helpers). |
| `__tests__/` | Jest tests mirroring the folders above, plus integration tests across stores. |
| `supabase/` | SQL migration and setup guide for the optional sync backend. |

## State: Zustand stores and persistence

Each domain has its own store in `stores/`, re-exported from `stores/index.ts`:

| Store | Responsibility |
|-------|----------------|
| `settings-store` | App and Pomodoro settings, onboarding flag, "Reset All Data". |
| `todo-store` | Tasks, subtasks, priorities, filters. |
| `category-store` | Task categories. |
| `pomodoro-store` | Timer state machine and the session history. |
| `gamification-store` | XP, level, streaks, combos, achievements, daily stats, prestige. |
| `daily-quests-store` / `weekly-goals-store` | Today's quests and this week's goals with progress. |
| `sync-store` / `auth-store` | Queue and status for the optional sync, and the optional sign-in session. |

Persistence uses Zustand's `persist` middleware with `createJSONStorage(() => AsyncStorage)`. Each store writes under its own AsyncStorage key, chooses what to persist with `partialize`, and stores that evolve use a `version` plus `migrate`. Stores expose a hydration flag where the UI must wait for data before routing. **Reset All Data** removes the persisted keys and resets the stores' in-memory state.

Stores talk to each other through their public actions (for example, completing a Pomodoro calls into the gamification and todo stores); there is no global event bus.

## Timer model

The Pomodoro timer is driven by **wall-clock timestamps**, never by counting ticks.

- A running phase stores `startedAt` (epoch milliseconds), `totalTime` (the phase length) and the accumulated paused duration.
- The moment the phase ends is therefore `startedAt + totalTime + total paused duration`. Remaining time is always computed as *end time − now*, so it is correct after any delay: backgrounding, device sleep, or the app being killed and reopened. The timer state is persisted, so a session survives app restarts.
- **JS intervals only drive the UI.** A one-second interval re-renders the countdown while the app is in the foreground; it is stopped in the background and is not relied upon for correctness. When the app returns to the foreground it re-derives the remaining time from the timestamps and, if the phase has already ended, completes it then.
- **End-of-phase alerts are pre-scheduled local notifications.** When a phase starts or resumes, the app schedules a notification for the exact end timestamp; pausing, stopping or skipping cancels it and rescheduling happens on resume. Because the operating system delivers the alert, it fires with the screen off or the app suspended, with no running JS required. Notifications use the `pomodoro` channel (Android) and a bundled sound.
- Completing a focus phase hands off to the gamification flow below; the next phase (short or long break, based on the configured number of sessions until a long break) can optionally auto-start.

Because the OS owns the alert, behaviour around exact alarms, Do Not Disturb and battery optimisation differs between iOS and Android versions. Always test timer changes on both platforms (see [CONTRIBUTING.md](../CONTRIBUTING.md)).

## Gamification flow

Static definitions live in `constants/` (XP values, levels, achievements, quest and goal templates, combo tiers); the mutable progress lives in the stores.

1. A user action completes a **focus session** (`pomodoro-store`) or a **task** (`todo-store`).
2. The store calls `gamification-store` (`incrementPomodoro` / `incrementTaskCompleted`), which updates lifetime stats and today's `dailyStats`.
3. XP is awarded with a **combo multiplier** (consecutive sessions, daily streak), `addXp` recomputes the level, and `updateStreak` maintains the daily streak.
4. The same call advances **daily quests** and **weekly goals** (`daily-quests-store`, `weekly-goals-store`), which award bonus XP when completed.
5. `checkAchievements` evaluates every achievement against the new stats and unlocks the ones that are met, including time-of-day ones.
6. Level-ups, unlocked achievements and XP gains are queued as pending notifications that the UI shows as modals and toasts.
7. A **daily summary** is built from the day's stats, and a **monthly prestige** step (`services/gamification/prestige-service`) pays out month-end rewards and starts a new season.

Quest and goal targets are scaled from the user's recent activity, so templates in `constants/` describe ranges rather than fixed numbers.

## Internationalization

- [i18next](https://www.i18next.com/) with react-i18next, configured in `services/i18n/i18n-config.ts`.
- Translations are flat key/value JSON files: `locales/en.json` and `locales/tr.json`. English is the fallback language.
- The initial language comes from the device locale (`expo-localization`): Turkish if the device is Turkish, otherwise English. Users can override it in Settings, which calls `changeLanguage`.
- Rule: every user-facing string goes through i18next, and every key exists in both files with matching `{{placeholders}}`. `__tests__/i18n/translation-completeness.test.ts` enforces this.

## Optional sync (experimental)

Sync is disabled unless both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` are set at build time. When it is off, no network request to a backend is ever made.

When enabled:

- **Write path:** local changes are applied to the Zustand stores first, then queued as operations in `sync-store` and pushed to Supabase in batches, with retries and exponential backoff.
- **Read path:** on launch and when returning to the foreground, the app pulls rows changed since `lastSyncedAt` and merges them into the local stores. Conflicts resolve **last write wins** on `updated_at`.
- **Backend:** the schema, indexes, `updated_at` triggers and Row Level Security policies are in [`supabase/migrations`](../supabase/migrations). Every table is restricted to its owner. Setup is described in [`supabase/README.md`](../supabase/README.md).

The sync protocol and schema are experimental and may change.
