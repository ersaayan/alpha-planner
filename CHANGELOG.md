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

### Changed

- Upgraded to Expo SDK 58.
- Pomodoro timer: remaining time is derived from wall-clock timestamps, and end-of-phase alerts are scheduled up front as local notifications so they fire reliably with the screen off or the app in the background.
- Cloud sync is optional and enabled only when both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` are set.
- `.gitignore` now covers `.env` files, build artifacts, signing material and editor or assistant state.

### Removed

- iPad (tablet) support for the first release.
- The `scripts/reset-project.js` leftover from the Expo project template, which deleted source directories.
- IDE and AI-assistant files (`.idea/`, `.superpowers/`, `.agents/`, `.claude/`, `skills-lock.json`, `.vscode/settings.json`) and internal planning documents from version control. They remain in git history.

[Unreleased]: https://github.com/ersaayan/alpha-planner/commits/master
