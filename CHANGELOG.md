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

### Removed

- iPad (tablet) support for the first release.
- The `scripts/reset-project.js` leftover from the Expo project template, which deleted source directories.
- IDE and AI-assistant files (`.idea/`, `.superpowers/`, `.agents/`, `.claude/`, `skills-lock.json`, `.vscode/settings.json`) and internal planning documents from version control. They remain in git history.

[Unreleased]: https://github.com/ersaayan/alpha-planner/commits/master
