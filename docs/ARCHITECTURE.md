# Architecture

A short, factual map of how Alpha Planner is put together. It describes the model, not line-level details; the code is the source of truth.

## Overview

Alpha Planner is an [Expo](https://expo.dev) / React Native app written in TypeScript. Screens live in `app/` (Expo Router), UI state lives in [Zustand](https://zustand.docs.pmnd.rs/) stores that persist themselves to AsyncStorage, and a small set of services wraps platform features (notifications, background work, i18n, optional sync).

The app is **local-first**: it works with no account and no network. Everything below the "Optional sync" section runs entirely on the device.

## Folders

| Folder | Contents |
|--------|----------|
| `app/` | Screens and navigation. File-based routes for Expo Router: tabs (dashboard, Pomodoro, tasks, stats, settings), onboarding, task create/detail, the kanban / calendar / timeline views, the optional sign-in modal and `+not-found`. |
| `components/` | Reusable UI: animated primitives, charts, gamification modals and toasts, the circular timer, navigation (including the guarded root stack), the optional sync account card. |
| `constants/` | Static configuration: theme and Eva theme, animations, XP values, levels, achievements, daily quests, weekly goals, combo multipliers, defaults. |
| `hooks/` | React hooks: app start-up (`use-app-bootstrap`), color scheme, sync trigger, sign-in completion. |
| `locales/` | `en.json` and `tr.json` translation files. |
| `services/` | Non-UI logic: `app/` (start-up tasks), `notifications/`, `background/`, `gamification/` (daily summary, monthly prestige), `i18n/`, and the optional `supabase/` + `sync/`. |
| `stores/` | Zustand stores (see below). |
| `types/` | Shared TypeScript types. |
| `utils/` | Pure helpers (dates, validators, ids, timer maths, theme helpers). |
| `__tests__/` | Jest tests mirroring the folders above, plus integration tests across stores. |
| `supabase/` | SQL migrations and setup guide for the optional sync backend. |

## State: Zustand stores and persistence

Each domain has its own store in `stores/`, re-exported from `stores/index.ts`:

| Store | Responsibility |
|-------|----------------|
| `settings-store` | App and Pomodoro settings, onboarding flag, "Reset All Data" (implemented in `stores/reset-all-data.ts`). |
| `todo-store` | Tasks, subtasks, priorities, filters. |
| `category-store` | Task categories. |
| `pomodoro-store` | Timer state machine and the session history. |
| `gamification-store` | XP, level, streaks, combos, achievements, daily stats, prestige. |
| `daily-quests-store` / `weekly-goals-store` | Today's quests and this week's goals with progress. |
| `sync-store` / `auth-store` | Queue (per signed-in account) and status for the optional sync, and who is signed in. The session tokens live in the Supabase client's own storage, not here. |

Persistence uses Zustand's `persist` middleware. Every store except `pomodoro-store` builds its options with `createPersistOptions` (`stores/persist.ts`), which guarantees that user data survives launches and upgrades:

- **Nothing is written before hydration.** Zustand saves on every `set()`, even before the stored data has loaded; the shared storage drops those writes until the store has merged what is on disk, so early defaults can never overwrite the user's data.
- **Every store has a `version` and a real `migrate`**, and stored data is **deep-merged over the defaults**, so a field added in a later release gets its default instead of `undefined`.
- **Unreadable or unmigratable data is backed up** to `<key>:backup` before the store falls back to defaults. If storage cannot be read at all, the store runs on defaults for the session and leaves the stored copy untouched.

`stores/hydration.ts` exposes `useStoresHydrated()` and `whenStoresHydrated()`. **Reset All Data** (`stores/reset-all-data.ts`) removes every stored key and backup, returns every store to its first-launch state, cancels and dismisses notifications, signs out of the optional sync, and re-creates default categories, quests and goals.

Stores talk to each other through their public actions (for example, completing a Pomodoro calls into the gamification and todo stores); there is no global event bus.

## Start-up and navigation

`app/_layout.tsx` keeps the splash screen up until fonts are loaded and `useAppBootstrap` (`hooks/use-app-bootstrap.ts`) reports the stores hydrated (with a 5-second fallback). Only then does it create first-launch defaults (categories), apply the monthly prestige, generate today's quests and this week's goals (`services/app/startup-tasks.ts`) and restore the saved language. The date-dependent tasks run again when the app returns to the foreground and when the local date changes while it is open.

Routing is decided by `Stack.Protected` guards in `components/navigation/root-stack.tsx`, not by redirects inside screens, so deep links, the Android back button and the iOS edge swipe all respect them:

- onboarding is reachable only until it is completed, the tabs and every other screen only after; completing or resetting onboarding switches sides automatically;
- the sign-in screens exist only in builds with sync configured, as an optional modal opened from Settings;
- unknown routes show `app/+not-found.tsx`.

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
- The language follows the device locale (`expo-localization`) by default: Turkish if the device is Turkish, otherwise English. Users can pick a language in Settings; the choice is restored at start-up once the settings store has loaded, and "System" follows the device language again on resume.
- Rule: every user-facing string goes through i18next, and every key exists in both files with matching `{{placeholders}}`. `__tests__/i18n/translation-completeness.test.ts` enforces this.

## Optional sync (experimental)

Sync is disabled unless both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` are set at build time. `services/supabase/client.ts` then exports `supabase = null` and `isSyncConfigured = false`: no account UI is shown, nothing is queued and no network request to a backend is ever made.

When enabled:

- **Sign-in is optional:** Settings → Sync offers "Sign in to sync". The auth store mirrors Supabase's `onAuthStateChange` events; tokens refresh only while the app is in the foreground. Sign-out is local-only and works offline. Signed-in users can delete their account (the `delete_account` RPC), which also erases the local data.
- **Write path:** local changes are applied to the Zustand stores first, then queued in `sync-store`, but only while someone is signed in. Each operation is tagged with its account; signing out or signing in with another account clears the queue, so one account's changes are never uploaded to another. On launch and on resume the queue is pushed in order; a failed operation stays queued and is retried on the next sync.
- **Read path: not implemented yet.** Pulling and merging remote changes (last write wins on `updated_at`) is planned; until then the cursor is not advanced.
- **Backend:** the schema, indexes, `updated_at` triggers, Row Level Security policies and the account deletion RPC are in [`supabase/migrations`](../supabase/migrations). Every table is restricted to its owner. Setup is described in [`supabase/README.md`](../supabase/README.md).

The sync protocol and schema are experimental and may change.
