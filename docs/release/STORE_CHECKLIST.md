# Store checklist: publishing Alpha Planner 1.0

A step-by-step guide for the owner to publish version 1.0.0 on the Apple App Store (iPhone only) and Google Play. It assumes the local-first build: **no login, no sync, no analytics**. Store copy (English and Turkish) is drafted in [store-listing.md](store-listing.md).

Tick the boxes as you go. Steps marked ⏳ take days, so start them first.

App identifiers (from `app.json`):

| | |
|---|---|
| Name | Alpha Planner |
| Version | 1.0.0 (build numbers are managed by EAS: `appVersionSource: "remote"`, `autoIncrement` in the production profile) |
| iOS bundle ID | `com.ersaayan.alphaplanner` |
| Android package | `com.ersaayan.alphaplanner` |
| EAS project | `ersaayan/alpha-planner` (`extra.eas.projectId` is already set) |
| Privacy policy | <https://github.com/ersaayan/alpha-planner/blob/master/PRIVACY.md> (also linked in Settings → About) |
| Support URL | <https://github.com/ersaayan/alpha-planner/issues> |
| Category | Productivity (both stores) |
| Price | Free, no in-app purchases, no ads |

---

## 0. Before anything else

- [ ] Merge the release branch into `master` and push, so the privacy policy URL and the issue forms linked from the app are live.
- [ ] ASSETS.md: fill in the source and license of the icon, splash art and `timer_complete.wav` (they are still `TODO(owner)`). Replace anything you cannot license for redistribution.
- [ ] README: add screenshots (the `TODO(owner)` comment), ideally the same ones as the stores.
- [ ] Make sure the production build has **no** Supabase variables: `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_KEY` must not be set in `eas.json`, in EAS environment variables for "production", or in a local `.env` used for the build. The "Data Not Collected" answers below are only true without them.

## 1. Developer accounts ⏳

### Apple Developer Program

- [ ] Enroll at <https://developer.apple.com/programs/enroll/> (99 USD/year). Use an Apple ID with two-factor authentication. As an individual, the seller name shown on the App Store is your legal name; as an organization you need a D-U-N-S number.
- [ ] Wait for the enrollment to be approved (usually 1–2 days).
- [ ] In App Store Connect → **Business**, accept the agreements (the free-apps agreement is enough; no banking or tax forms are needed for a free app).

### Google Play Console

- [ ] Create a developer account at <https://play.google.com/console/signup> (25 USD once) and complete identity verification (and phone/address verification if asked).
- [ ] ⏳ **New personal accounts must run a closed test before production:** at least **12 testers** must stay opted in for **14 consecutive days** before you can apply for production access. Plan for this: create the app and a closed testing track as soon as the first build exists (step 3), invite 12+ people (a Google Group or an email list), and keep them opted in for the full 14 days. Then apply for production access in the Dashboard and answer the questions about your test.
- [ ] Organization accounts do not have this requirement, but need a D-U-N-S number.

## 2. EAS (Expo Application Services)

```bash
npm i -g eas-cli
```

```bash
eas login
```

- [ ] `eas whoami` shows the account that owns the `ersaayan/alpha-planner` project.
- [ ] Optional: `eas build:version:get` to see the current remote build numbers.

### Production builds

```bash
eas build --platform all --profile production
```

- [ ] **iOS:** let EAS create the distribution certificate and provisioning profile when asked (log in with your Apple ID). EAS also registers the bundle ID and enables its capabilities from the entitlements: **Time Sensitive Notifications** (used by the timer alerts) and **Push Notifications** (added by expo-notifications; the app sends no push, it is harmless).
- [ ] **Android:** let EAS generate the upload keystore. It is stored on EAS; download a backup with `eas credentials` → Android → Download keystore, and keep it safe.
- [ ] Both builds finish and you can install the Android AAB via internal testing and the iOS build via TestFlight.

### Play App Signing and the first upload

- [ ] In Play Console, create the app (name Alpha Planner, default language, App, Free) and accept the declarations.
- [ ] **Upload the first AAB manually** (Play Console → Testing → Internal testing → Create release). Google Play needs the first release of a new app to be uploaded in the console; `eas submit` works for later releases.
- [ ] Accept **Play App Signing** when asked (Google keeps the app signing key, the EAS keystore is your upload key).

### Later releases with EAS Submit

```bash
eas submit --platform ios --profile production
```

```bash
eas submit --platform android --profile production
```

- [ ] iOS: EAS Submit asks for (or creates) an App Store Connect API key.
- [ ] Android: create a Google Cloud service account with access to the Play Console app (Play Console → Users and permissions) and give its JSON key to EAS (`eas credentials` or the `serviceAccountKeyPath` in `eas.json` → `submit.production.android`). Do **not** commit the key.

## 3. Device test pass (before submitting)

No device testing has been possible on the development Mac (no Xcode or Android SDK), so this pass is the only check of native behavior.

- [ ] Install the production (or preview) build on **at least one iPhone and one Android phone**, ideally a small iPhone (SE/mini) and an Android 14+ phone.
- [ ] Run [docs/testing/timer-manual-test-plan.md](../testing/timer-manual-test-plan.md) and fill in its results table. The highest-risk cases: phase-end alert with the screen off and in Doze, the Android exact-alarm prompt, tapping a notification after the app was swiped away, Time Sensitive alerts under an iOS Focus mode.
- [ ] Also check, in Turkish and English, light and dark mode:
  - [ ] onboarding → Dashboard; fold/unfold the Dashboard cards; restart: folded cards and week start stay as set;
  - [ ] create a task with a due date and time (date picker in your language, Monday/Sunday first as set), get the reminder at that time, open it from the notification;
  - [ ] VoiceOver (iOS) / TalkBack (Android): complete a task from the list with the checkbox, move it on the kanban board, toggle settings, close a dialog;
  - [ ] the largest accessibility text size: Welcome, Dashboard and Calendar scroll, buttons grow instead of clipping, the timer digits stay inside the circle;
  - [ ] Reduce Motion on: no pulsing/shimmering;
  - [ ] keyboard: task title, subtask, new category (Settings and onboarding) stay visible above the keyboard;
  - [ ] Settings → Data: export to Files/Drive, import it back; Settings → About links open in the browser;
  - [ ] celebrations (achievement, level up, XP) appear one at a time and close.

## 4. Store listings

Use [store-listing.md](store-listing.md) for the texts (English as the primary language, Turkish as a second localization).

### Screenshots and graphics

- [ ] **iOS:** 6.9" iPhone screenshots (1320 × 2868 or 1290 × 2796 px, portrait), 3–10 per language. Smaller iPhone sizes are scaled from these. No iPad screenshots are needed (`supportsTablet: false`).
- [ ] **Google Play:** 2–8 phone screenshots (PNG or JPEG, 16:9 or 9:16, each side 320–3840 px); a **1024 × 500 feature graphic**; the 512 × 512 app icon (32-bit PNG).
- [ ] Suggested set: Dashboard, Pomodoro timer running, task list with filter sheet, kanban board, calendar, stats/achievements, dark mode, Turkish.

### App Store Connect

- [ ] Create the app: iOS, name **Alpha Planner** (if the name is taken, use "Alpha Planner: Focus & Tasks"), primary language English, bundle ID above, SKU e.g. `alpha-planner-1`.
- [ ] Add the Turkish localization and fill in both from store-listing.md: subtitle, promotional text, description, keywords, support URL, privacy policy URL, copyright (e.g. "2026 <your name>").
- [ ] Category: **Productivity** (leave the secondary category empty).
- [ ] **App Privacy:** "Data Not Collected". (True only for the local-first build without sync; see step 0.)
- [ ] **Age rating:** answer the (new, mandatory since 31 January 2026) age rating questionnaire: no objectionable content, no user-generated content, no chat, no web browsing, no gambling, no ads. Expect the lowest rating (4+).
- [ ] **Export compliance:** `ITSAppUsesNonExemptEncryption` is `false` in `app.json`, so no questions should appear; if asked, the app uses no encryption beyond the operating system's (exempt).
- [ ] **EU Digital Services Act:** declare your trader status (App Store Connect → Business → Compliance). A free app published by a private individual without commercial activity is normally "not a trader"; if you are a business or monetize, you are a trader and your contact details are shown in the EU.
- [ ] Pricing: Free; availability: all countries (or your choice).
- [ ] Review notes (App Review Information), e.g.:

  > Alpha Planner is local-first: there is no account or login, so no demo account is needed. All data stays on the device.
  > The Pomodoro timer schedules local notifications for the end of each focus session or break. They use the Time Sensitive interruption level so the alert reaches the user even in a Focus mode, which is the core purpose of a timer. No remote/push notifications are sent.
  > Settings → About links to the privacy policy.

- [ ] Attach the TestFlight build, then **Submit for Review**.

### Google Play Console

- [ ] **Main store listing:** app name, short description (≤ 80 characters), full description, graphics; add the Turkish translation.
- [ ] **App category:** Productivity. Contact details: email (required), website optional (the GitHub repo).
- [ ] **Privacy policy:** the URL above.
- [ ] **Data safety:** "No data collected" and "No data shared". (True only without sync; see step 0.) Answer that the app does not use encryption in transit for user data because none leaves the device, and that users can delete data (Reset All Data, uninstall).
- [ ] **Ads:** the app contains no ads.
- [ ] **Content rating (IARC):** complete the questionnaire (Utility/Productivity; no violence, no user interaction or sharing, no location). Expect "Everyone"/PEGI 3.
- [ ] **Target audience:** 13+ or 18+ (the app is not directed at children; choosing an under-13 age group adds Families policy requirements).
- [ ] **Government app / financial features / health:** no.
- [ ] **EU Digital Services Act:** declare trader or non-trader status, as above.
- [ ] **Permissions:** the manifest asks only for `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` and `SCHEDULE_EXACT_ALARM` (storage, overlay and microphone permissions are blocked in `app.json`). If the console asks about exact alarms, explain:

  > The app is a Pomodoro timer. Its core function is to alert the user at the exact end of a focus session or break, which requires exact alarms (AlarmManager setAlarmClock). The user grants "Alarms & reminders" from the app's Notification reliability screen; without it the timer still works but alerts may be delayed.

- [ ] Release notes for 1.0.0 from store-listing.md ("What's new").
- [ ] Closed test with 12+ testers for 14 days (step 1), then apply for production access, then promote the release to Production.

## 5. After release

- [ ] Tag the release: `git tag v1.0.0 && git push --tags`, and create a GitHub release with the 1.0.0 notes from CHANGELOG.md.
- [ ] Watch the crash reports in App Store Connect (TestFlight/Xcode Organizer) and Play Console (Android vitals) for the first days.
- [ ] Reply to store reviews in both languages; route bugs to GitHub issues.
