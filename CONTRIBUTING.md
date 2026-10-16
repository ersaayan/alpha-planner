# Contributing to Alpha Planner

Thanks for your interest in improving Alpha Planner! Bug reports, feature ideas, translations, documentation fixes and code contributions are all welcome.

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem, please do **not** open a public issue; follow [SECURITY.md](SECURITY.md) instead.

## Before you start

- **Bugs:** search the [existing issues](https://github.com/ersaayan/alpha-planner/issues) first, then open one with the bug report template.
- **Features:** open a feature request and wait for feedback before investing in a large change. Alpha Planner is deliberately local-first (no account, no analytics), so features that need a server or tracking are unlikely to be accepted into the default build.
- **Small fixes** (typos, docs, obvious bugs) can go straight to a pull request.

## Development setup

You need Node.js 22 LTS, Xcode 26 or newer for iOS, and Android Studio for Android. The app needs a **development build**; Expo Go is not supported (custom notification sounds and native configuration).

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/alpha-planner.git
cd alpha-planner

# 2. Install dependencies from the lockfile
npm ci

# 3. Build and run a development build (first time, or after native changes)
npx expo run:ios
npx expo run:android

# 4. Afterwards, just start the dev server
npm start
```

Optional experimental sync is off unless you create a `.env` from [`.env.example`](.env.example) with both Supabase variables set. You do not need it to work on the app. See [supabase/README.md](supabase/README.md) if you do.

For an overview of the codebase read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Branching

1. Create your branch from the latest `master` in your fork.
2. Use a short, descriptive name with a type prefix, for example `feat/weekly-goal-editing`, `fix/timer-resume-drift` or `docs/readme-typos`.
3. Keep each branch focused on one change. Unrelated fixes belong in separate pull requests.
4. Open the pull request against `master`.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/). The existing history already follows this style.

```
<type>(<optional scope>): <short summary in the imperative mood>
```

Common types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `ci`, `perf`. Examples:

```
feat(todos): add subtask reordering
fix(pomodoro): keep the break notification when the app is force-quit
test: cover weekly goal rollover
docs: explain how to run sync against a local Supabase
```

Explain the *why* in the body when it is not obvious. Mark breaking changes with `!` after the type or a `BREAKING CHANGE:` footer.

## Required checks

Every pull request must pass all of these locally, and the same checks run in CI:

```bash
npm run typecheck
npm run lint
npm test
```

Add or update tests for the behaviour you change. Stores, utilities and gamification rules have unit tests under `__tests__/`; screens and components have React Native Testing Library tests.

## Internationalization (i18n) rule

Alpha Planner ships in Turkish and English, and **every user-facing string must go through i18next**.

- Never hard-code text in components, alerts, notifications or accessibility labels. Use `t('some.key')` (or the shared i18n instance outside React).
- Every key must exist in **both** [`locales/en.json`](locales/en.json) and [`locales/tr.json`](locales/tr.json), with the same `{{placeholders}}`. A test in `__tests__/i18n/` fails the build if the two files drift apart.
- Keep keys grouped by area (`settings.*`, `todo.*`, `gamification.*`, ...) and sorted the way the surrounding keys are.
- If you do not speak Turkish, add your best translation and say so in the pull request; a maintainer or another contributor will review it.

## Timer and notification changes: test on both platforms

The Pomodoro timer and its alerts behave differently on iOS and Android, and unit tests cannot cover the operating system. If your change touches the timer, background handling, scheduling or notifications, please test on **both an iOS and an Android device or emulator** and mention what you tried in the pull request. At minimum check:

- starting, pausing, resuming and stopping a session;
- the screen turned off, and the app sent to the background, when a phase ends;
- the app force-quit and reopened after a phase has ended;
- notification permission denied, and Do Not Disturb or silent mode on;
- the app still shows the right remaining time after a long time in the background.

Notification sounds, exact-alarm behaviour and background execution limits differ between OS versions, so say which versions you used.

## Pull request checklist

The [pull request template](.github/pull_request_template.md) asks for the following:

- [ ] The change is focused and the PR description explains what and why.
- [ ] `npm run typecheck`, `npm run lint` and `npm test` pass.
- [ ] Tests were added or updated for changed behaviour.
- [ ] No hard-coded user-facing strings; new keys exist in both `locales/en.json` and `locales/tr.json`.
- [ ] Timer or notification changes were tested on both iOS and Android.
- [ ] No secrets, `.env` files or personal data are included.
- [ ] New images, sounds or fonts have a compatible licence and are listed in [ASSETS.md](ASSETS.md).
- [ ] Docs (README, `docs/`, `CHANGELOG.md` under *Unreleased*) are updated when behaviour changes.

## Licensing of contributions

Alpha Planner is released under the [MIT License](LICENSE). By submitting a contribution you agree that it is licensed under the same terms.
