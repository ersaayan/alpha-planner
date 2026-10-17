# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Work towards the first public release, 1.0.0.

### Added

- Local-first operation: no account or login is required, and all data stays on the device.
- Turkish and English translations covering every user-facing string, with a test that enforces identical keys in both locale files.
- Open-source project files: MIT [LICENSE](LICENSE), English and Turkish READMEs, [CONTRIBUTING](CONTRIBUTING.md), [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md), [SECURITY](SECURITY.md), [PRIVACY](PRIVACY.md) policy, [ASSETS](ASSETS.md) provenance table and [architecture notes](docs/ARCHITECTURE.md).
- GitHub Actions CI (type-check, lint, tests), issue forms, a pull request template and Dependabot configuration.
- `.env.example` documenting the optional Supabase variables.
- Supabase schema migration for optional, experimental sync in [`supabase/migrations`](supabase/migrations), with a self-hosting guide.
- Builds with sync: optional "Sign in to sync" in Settings, sign-out that asks whether to keep the device's data, and account deletion (`delete_account` RPC, documented web deletion request).
- Versioned storage for every store, with migrations, defaults for new fields and a backup of unreadable data, so data survives launches and upgrades.
- A "page not found" screen.
- Dashboard cards for today's daily quests, this week's goals (with a personal goal editor), the active session/daily combo and the monthly season (when it ends, its rewards and how seasons work); a one-time summary of each finished season.
- Stats: achievements grouped by category with progress for locked ones (secret ones stay hidden) and the history of past seasons.
- Achievement, level-up and XP celebrations, queued so they never stack.
- Due times and due-time reminders for tasks (their own notification channel), subtasks on the create screen, renaming subtasks, removing a task's date or category, and filtering (category, priority) and sorting (due date, priority, newest) the task list.
- Settings → Data: export all data to a JSON file and import it on this or another device.
- Yesterday's daily summary on the first open of a day; tapping the 23:00 notification opens that day's summary.
- "Automatic" week start (Monday in Turkish, Sunday in English).

### Changed

- Upgraded to Expo SDK 58.
- Pomodoro timer: remaining time is derived from wall-clock timestamps, and end-of-phase alerts are scheduled up front as local notifications so they fire reliably with the screen off or the app in the background.
- Cloud sync is optional and enabled only when both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` are set. Without them the app no longer crashes at start, shows no account UI and queues nothing.
- Navigation uses guarded routes: first launch goes straight to onboarding and then the app, deep links and back gestures cannot skip or re-enter onboarding, and onboarding's Back buttons work.
- The splash screen stays up until saved data has loaded; default categories, quests and goals are created only afterwards, and quests and goals refresh when the day or week changes while the app is open.
- "Reset All Data" now erases every store (quests, goals, combo, prestige, sync and account state) and all scheduled notifications.
- The chosen language is restored at start-up; todo search matches Turkish İ/ı with I/i.
- Sync queues changes per account and never uploads one account's changes for another; failed uploads stay queued instead of being dropped.
- `.gitignore` now covers `.env` files, build artifacts, signing material and editor or assistant state.
- Every daily quest type progresses and only quests that can still be finished today are offered; every weekly goal moves and fits the days left in the week.
- XP and task counts are earned once per task and subtask (re-completing, archiving and restoring pay nothing extra); archived tasks keep their completion date.
- All 81 achievements are evaluated, with lifetime counters where 90 days of history were not enough; organizer and color collector count only your own categories.
- The level cap is 50 (the "max level" message showed from level 10) and the top level shows its XP instead of "Infinity XP".
- Credits are booked on the day they happened (a session that ended before midnight counts for that day); a missed day resets the streak and the daily combo; the session combo expires after a long gap.
- Monthly seasons reward what was done in that month, the reward XP is a head start for the new season, and seasons follow the local month.
- Due dates are stored as local calendar days, so they no longer move by a day across time zones.
- The timeline lists only open tasks; the calendar, timeline and charts use Turkish or English month and weekday names; the weekly charts say "last 7 days".
- Achievement names, level titles, tiers, quests, goals, season rewards, the daily summary and default category names are translated.

### Removed

- iPad (tablet) support for the first release.
- The `scripts/reset-project.js` leftover from the Expo project template, which deleted source directories.
- IDE and AI-assistant files (`.idea/`, `.superpowers/`, `.agents/`, `.claude/`, `skills-lock.json`, `.vscode/settings.json`) and internal planning documents from version control. They remain in git history.

### Planned for 1.1

- Recurring tasks.
- Undo for completing and deleting tasks.
- Drag and drop on the Kanban board (the arrow buttons stay).
- A focus-time-per-task chart.
- Sign in with Apple / Google (OAuth) for the optional sync.

[Unreleased]: https://github.com/ersaayan/alpha-planner/commits/master
