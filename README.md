# Alpha Planner

[![CI](https://github.com/ersaayan/alpha-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/ersaayan/alpha-planner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**English** · [Türkçe](README.tr.md)

Alpha Planner is a free, open-source productivity app for iOS and Android that combines a Pomodoro timer, a task manager and a gamification layer that rewards you for getting things done. It is built with React Native and Expo.

It is **local-first**: there is no account to create and no server involved. Your tasks, timer history and progress stay on your device.

## Screenshots

<!-- TODO(owner): add screenshots, e.g. docs/screenshots/{dashboard,pomodoro,tasks,stats}.png -->

_Screenshots coming soon._

## Features

- **Pomodoro timer** with customizable focus, short-break and long-break lengths. The end of every phase is announced by a local notification, so the timer keeps working when the screen is off or the app is in the background.
- **Task management** with subtasks, priorities and categories.
- **Four ways to look at your tasks:** list, kanban board, calendar and timeline.
- **Gamification:** earn XP, level up, unlock achievements, keep daily streaks, complete daily quests and hit weekly goals.
- **Dark mode** (light, dark or follow the system).
- **Turkish and English**, following your device language or your choice in Settings.

## Local-first and privacy

Alpha Planner needs no account and has no analytics, ads or tracking. All data is stored on the device and is removed when you delete the app or use **Reset All Data** in Settings. Notifications are scheduled locally. Read the full [privacy policy](PRIVACY.md).

An optional, experimental cloud sync exists for people who want to run their own backend; it is disabled by default (see [Optional: experimental sync](#optional-experimental-sync)).

## Tech stack

- [Expo](https://expo.dev) SDK 58 and React Native, with [Expo Router](https://docs.expo.dev/router/introduction/) for navigation
- TypeScript
- [Zustand](https://zustand.docs.pmnd.rs/) for state, persisted to AsyncStorage
- [i18next](https://www.i18next.com/) / react-i18next for translations
- [UI Kitten](https://akveo.github.io/react-native-ui-kitten/) (Eva Design System) for UI components
- [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) for timer alerts
- Jest and React Native Testing Library for tests
- [Supabase](https://supabase.com) (optional, experimental) for sync

## Getting started

### Prerequisites

- **Node.js 22 LTS** and npm
- **Xcode 26 or newer** (macOS only, for iOS builds and the iOS Simulator)
- **Android Studio** with an Android SDK and an emulator or a device (for Android builds)

### A development build is required

Alpha Planner does **not** run in Expo Go. It uses custom notification sounds and native configuration that Expo Go does not support, so you build a development client (`expo-dev-client`) once and then iterate with Metro as usual.

### Install and run

```bash
git clone https://github.com/ersaayan/alpha-planner.git
cd alpha-planner
npm ci

npx expo run:ios       # build and launch the development build on an iOS simulator or device
npx expo run:android   # build and launch the development build on an Android emulator or device
```

After the first native build, start only the dev server:

```bash
npm start
```

### Scripts

| Command | What it does |
|---------|--------------|
| `npm ci` | Install dependencies from the lockfile |
| `npm start` | Start the Metro dev server for the development build |
| `npx expo run:ios` | Build and run the iOS development build |
| `npx expo run:android` | Build and run the Android development build |
| `npm test` | Run the Jest test suite |
| `npm run typecheck` | Type-check with TypeScript |
| `npm run lint` | Lint with ESLint |

## Optional: experimental sync

The app can sync data with a [Supabase](https://supabase.com) backend that you host yourself. This feature is **experimental** and **off by default**. It turns on only when **both** of these variables are set at build time:

```bash
cp .env.example .env
# then fill in:
# EXPO_PUBLIC_SUPABASE_URL=...
# EXPO_PUBLIC_SUPABASE_KEY=...   # anon / publishable key only, never a service_role key
```

With sync on, signing in is still optional: the app works without an account, and **Settings → Sync** offers "Sign in to sync" (and account deletion). The database schema is in [`supabase/migrations`](supabase/migrations), and [`supabase/README.md`](supabase/README.md) walks through the setup. If you ship a build with sync enabled, you are responsible for your own privacy policy.

## Project structure

```
app/            Screens and navigation (Expo Router)
components/     Reusable UI components
constants/      Theme, animation and gamification configuration
hooks/          Custom React hooks
locales/        Translations (en.json, tr.json)
services/       Notifications, background tasks, i18n, optional sync
stores/         Zustand stores (persisted to AsyncStorage)
types/          TypeScript type definitions
utils/          Helper functions
assets/         Images, icons and sounds
supabase/       Optional sync schema and setup guide
__tests__/      Unit, integration and screen tests
docs/           Architecture notes
```

For how the pieces fit together (stores, the timer model, gamification, i18n and sync) see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Forking and publishing your own build

If you want to build and publish your own version, change at least the following so it does not collide with the original app:

- `expo.ios.bundleIdentifier` and `expo.android.package` in `app.json` (currently `com.ersaayan.alphaplanner`)
- `expo.owner` in `app.json` (your Expo account or organization; remove it if you build without EAS)
- `expo.extra.eas.projectId` in `app.json` (run `eas init` to create your own EAS project)
- the app icon, adaptive icon, notification icon and splash image in `assets/images/`; see [ASSETS.md](ASSETS.md) for what you may reuse
- the environment variables in your own `.env` (and in your EAS environment), if you enable sync

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md) first. To report a security issue, see [SECURITY.md](SECURITY.md).

## License

Alpha Planner is released under the [MIT License](LICENSE). Third-party assets are listed in [ASSETS.md](ASSETS.md).
