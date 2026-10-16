# Architecture

A short, factual map of how Alpha Planner is put together. It describes the model, not line-level details; the code is the source of truth.

## Overview

Alpha Planner is an [Expo](https://expo.dev) / React Native app written in TypeScript. Screens live in `app/` (Expo Router), UI state lives in [Zustand](https://zustand.docs.pmnd.rs/) stores that persist themselves to AsyncStorage, and a small set of services wraps platform features (notifications, i18n, optional sync).

The app is **local-first**: it works with no account and no network. Everything below the "Optional sync" section runs entirely on the device.

## Folders

| Folder | Contents |
|--------|----------|
| `app/` | Screens and navigation. File-based routes for Expo Router: tabs (dashboard, Pomodoro, tasks, stats, settings), onboarding, task create/detail, the kanban / calendar / timeline views, the optional sign-in modal and `+not-found`. |
| `components/` | Reusable UI: animated primitives, charts, gamification modals and toasts, the circular timer, navigation (including the guarded root stack), the optional sync account card. |
| `constants/` | Static configuration: theme and Eva theme, animations, XP values, levels, achievements, daily quests, weekly goals, combo multipliers, defaults. |
| `hooks/` | React hooks: app start-up (`use-app-bootstrap`), the timer's app lifecycle and alert permissions (`use-pomodoro-lifecycle`, `use-alert-permissions`), color scheme, sync trigger, sign-in completion. |
| `locales/` | `en.json` and `tr.json` translation files. |
| `services/` | Non-UI logic: `app/` (start-up tasks), `notifications/` (timer alerts, permissions, other notifications), `gamification/` (daily summary, monthly prestige), `i18n/`, and the optional `supabase/` + `sync/`. |
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

Persistence uses Zustand's `persist` middleware. Every store builds its options with `createPersistOptions` (`stores/persist.ts`), which guarantees that user data survives launches and upgrades:

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

The Pomodoro timer is driven by **wall-clock timestamps**, never by counting ticks. The maths lives in pure functions in `utils/pomodoro-helpers.ts`; the store (`stores/pomodoro-store.ts`), the alert scheduler and the screens all derive from them.

- **State.** A running phase stores `startedAt` (epoch ms), `totalTime` (its own length, fixed at start) and `totalPausedDuration`. Its end is `phaseEndMs = startedAt + (totalTime + totalPausedDuration) * 1000`. Remaining time is `phaseEndMs − now`, clamped to `[0, totalTime]`. `remainingTime` in the store is only a snapshot taken at the last state change and is never used to decide whether a phase has ended.
- **One completion path.** `reconcileTimer(timer, settings, now)` returns every phase whose end is at or before `now`, exactly once, and the state that follows. `syncTimer` feeds that into a single `commit` step that records the sessions, credits each finished focus once (gamification XP/quests/goals and the linked task count, using the phase's own length and its real end time) and queues the sync operation. The in-app clock, returning to the foreground, cold start and notification actions all go through it.
- **Auto-start chain.** When auto-start is on, a finished phase starts the next one at the exact end of the previous one. `chainIndex` counts phases since the user last started or resumed the timer. A chain is limited to `ALERT_CHAIN_LIMIT` (8) phase ends; after the last one the timer waits in the ready state of the next phase, so a phone left alone for hours does not collect phantom sessions.
- **In-app clock.** One timeout outside React wakes when the displayed second changes or the phase ends. It updates `usePomodoroClock` (a small non-persisted store the screens read) and calls `syncTimer` at the end. Nothing else depends on it, and JS timers stopping in the background is fine. The persisted store changes only on state changes, so AsyncStorage is not written every second.
- **Persistence.** The store persists `timer`, `sessions` (last 90 days) and `currentSession`, with `version` + `migrate` that repairs older or corrupted states. Catch-up does not run during hydration: `hooks/use-pomodoro-lifecycle.ts` waits until the settings, gamification, todo, daily-quest and weekly-goal stores have hydrated too, so a credit is never overwritten by a store that loads later.

### End-of-phase alerts

The operating system delivers every alert, so alerts fire with the screen off, the app suspended, or the app swiped away. `services/notifications/pomodoro-alerts.ts` owns them:

- **`armAlerts(snapshot)` is the only writer.** It is serialized and idempotent: each call describes the complete desired state, and calls made while one is running are coalesced. The store calls it on start, resume, phase change, pause, stop, skip, reset and setting changes. AppState changes never cancel or reschedule anything.
- **The whole chain is pre-scheduled.** On start or resume, every phase end up to the next manual start (at most 8) is scheduled as a `DATE` notification with a fixed identifier per chain position, `pomodoro-phase-end-<chainIndex>`. Re-arming replaces those ids instead of adding new ones. Pause, stop, skip and reset cancel them. After a phase completes, alerts of the phases that already ended are left alone, because they may still be about to fire.
- **Foreground.** Alerts stay armed while the app is open. The notification handler shows the banner and plays the sound, and the app adds a haptic when its own clock completes the phase.
- **Taps and actions.** Every timer notification carries `data.url = '/pomodoro'`; a tap opens the Pomodoro screen, also on cold start (via the last notification response). Action buttons (Pause, Resume, Skip, Stop) open the app so they also work after it was killed; the timer is synced before the action is applied.
- **Settings.** Nothing is scheduled when the in-app notifications toggle is off (the daily summary included). Changing sound, vibration, durations, auto-start, time format or language re-arms the chain.
- **Permission.** Launch never prompts. The Pomodoro screen asks at the first Start, after a short explanation; if notifications are denied it shows a banner that opens Settings. Turning the in-app toggle back on asks again.

**Android**

- The channel is set in the **trigger** (`{ type: DATE, date, channelId }`), never in `content`. Alert channels are versioned (`pomodoro-alert-…-v2`) because a channel's sound and vibration are fixed once created: one per sound/vibration combination, with `timer_complete.wav` and a vibration pattern. Old channels are deleted. Channel names are localized.
- Triggers use `delivery: 'alarmClock'` (`AlarmManager.setAlarmClock`), which Doze and OEM battery savers do not defer. That needs the exact-alarm permission (`SCHEDULE_EXACT_ALARM`), which Android 14+ denies by default. Without it the alarm silently becomes inexact and can be many minutes late, so the Pomodoro screen shows a prompt that opens "Alarms & reminders" (`requestExactAlarmPermissionsAsync`), and alerts are re-armed once it is granted.
- While a phase runs or is paused, an ongoing notification shows "Ends at HH:MM" (or the paused remaining time) with action buttons. It uses the same identifier as the current phase's alert, so the alert replaces it when the phase ends. There is no foreground service.
- `app/settings/notification-reliability.tsx` checks the permission, the alert channel and exact alarms, links to the battery optimisation list and to dontkillmyapp.com for the phone's maker, and can send a test alert.

**iOS**

- Alerts use `interruptionLevel: 'timeSensitive'` (entitlement in `app.json`) so they break through Focus modes the user has not restricted. The app has no `UIBackgroundModes`, and must not play audio in the background.
- iOS keeps at most 64 pending notifications; the chain uses at most 8.

Because the operating system owns the alerts, behaviour differs between iOS and Android versions and phone makers. Always test timer changes on both platforms with [the manual test plan](testing/timer-manual-test-plan.md) (see also [CONTRIBUTING.md](../CONTRIBUTING.md)).

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
