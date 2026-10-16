# Timer manual test plan

Unit tests cover the timer maths, the alert chain and the lifecycle wiring, but only a real device shows whether the operating system rings on time. Run this plan on **at least one iPhone and one Android phone** before a release, and for any change to the timer, notifications or app lifecycle. Note the device, OS version and build in the results table at the end.

How the timer works is described in [ARCHITECTURE.md](../ARCHITECTURE.md#timer-model).

## Setup

1. Install a **development or preview build** (`eas build --profile development` or `--profile preview`). Expo Go is not supported.
2. Short durations make the plan practical. Settings allow at least 15 min focus, 3 min short break and 10 min long break. For quicker runs in a local development build, temporarily lower the sliders' `minimumValue` in `app/(tabs)/settings.tsx` to 1 (do not commit this) and set 1 min focus / 1 min breaks, 2 sessions until a long break. Otherwise run the break-only path for single-phase cases: start a focus, tap **Skip to Break**, start the 3-minute break.
3. Settings: notifications on, sound on, vibration on, auto-start off, unless a case says otherwise.
4. Ring/silent switch off (iOS) and ringer volume up (Android), unless a case says otherwise.
5. Android 12+: open **Settings → Notification reliability** and allow "Alarms & reminders", unless the case tests the denied state.
6. "Alert" below means: banner or heads-up notification, `timer_complete.wav`, and vibration (where enabled), within **±5 s** of the time shown in the app.

Useful Android commands (USB debugging on):

```bash
adb shell dumpsys deviceidle force-idle      # enter Doze now (screen must be off)
adb shell dumpsys deviceidle unforce         # leave Doze
adb shell dumpsys alarm | grep -A3 alphaplanner   # pending alarms; look for the alarm-clock entries
adb shell cmd appops get com.ersaayan.alphaplanner SCHEDULE_EXACT_ALARM
adb shell pm revoke com.ersaayan.alphaplanner android.permission.SCHEDULE_EXACT_ALARM   # simulate denied (app restarts)
```

## 1. Core alert paths (both platforms)

| ID | Steps | Expected |
|----|-------|----------|
| C1 | Start a phase and keep the app open on the Pomodoro screen until it ends. | Alert while the app is open (banner + sound), phone buzzes, screen moves to the next phase. One alert only. |
| C2 | Start a phase, lock the phone (screen off) until it ends. | Alert on the lock screen on time. Unlock: app shows the next phase, no second alert. |
| C3 | Start a phase, go to the home screen, open another app until it ends. | Alert on time. Returning to the app does not ring again. |
| C4 | Start a phase, **swipe the app away** from the app switcher, wait for the end. | Alert on time. Reopen: next phase shown, the session is credited once (Stats/XP +1 focus). |
| C5 | Start a focus phase, unlock the phone or pull down Control Center / the notification shade several times after the halfway point. | Timer keeps counting; the phase does **not** end early. |
| C6 | Start a focus phase, wait until it ends with the phone locked, then open the app. | Focus counted once: XP, daily quest and weekly goal move by one session; session dots advance by one. |
| C7 | Start, pause after 20 s, wait 1 min, resume. | No alert while paused. Alert at the original end + the paused time. |
| C8 | Start, then Stop. | No alert ever arrives. Display shows the configured focus length (not 25:00 if focus is set to 50). |
| C9 | Start, then Skip. | No alert for the skipped phase. Next phase waits for Start. |
| C10 | Tap the alert notification while the app is in the background. | App opens on the Pomodoro screen. |
| C11 | Swipe the app away, wait for the alert, tap it. | App cold-starts on the Pomodoro screen, state correct. |
| C12 | Change sound or vibration in Settings while a phase is running. | The alert at the end uses the new setting. |
| C13 | Turn off "Enable Notifications" in Settings while running. | No alert, no daily summary at 23:00. Turn it back on: alert re-armed. |
| C14 | Change the app language while a phase runs. | Alert text in the new language. Android: channel names in the new language. |

## 2. Auto-start chains

Turn on both auto-start options (sessions until long break = 2 makes the long break come sooner).

| ID | Steps | Expected |
|----|-------|----------|
| A1 | Start focus, lock the phone for focus + break + focus. | Three alerts, each on time, each saying which phase started and when it ends. |
| A2 | Start focus, swipe the app away, wait for focus + break. | Both alerts arrive although the app is not running. |
| A3 | Start focus and leave the phone locked for more than 8 phases. | Exactly 8 alerts; the 8th says auto-start paused. Opening the app shows the timer stopped, ready for the next phase. Stats show at most 8 phases (4 focus). |
| A4 | Auto-start breaks only; let focus end with the app open. | Break starts at the focus end; its alert arrives on time. |
| A5 | During a chain, pause and resume. | Alerts move by the paused time; the chain restarts (up to 8 more phases). |

## 3. Permissions and settings

| ID | Steps | Expected |
|----|-------|----------|
| P1 | Fresh install. Launch and finish onboarding. | No notification prompt at launch. |
| P2 | Fresh install, tap Start Focus. | Short explanation, then the system prompt. Allow → alert at the end. |
| P3 | Deny the system prompt. | Banner on the Pomodoro screen ("Notifications are off") with a button to Settings. Enabling there and returning hides the banner. |
| P4 | Android 13+: in system settings, turn off the "Timer alerts" channel. | Banner "Timer alerts are turned off…", button opens that channel's settings. |
| P5 | Android 14+: fresh install (exact alarms denied by default). | Banner "Alerts may arrive late"; **Allow** opens "Alarms & reminders". After allowing, return: banner gone, `dumpsys alarm` shows an alarm-clock alarm for the app. |
| P6 | Android: revoke exact alarms (`pm revoke …` above), start a phase, screen off, `force-idle`. | Expect a late alert (this documents the denied behaviour; note the delay). Allowing again and restarting the phase restores on-time alerts. |
| P7 | Settings → Notification reliability → Send a test alert, lock the phone. | Alert arrives in about 10 s with sound/vibration. |

## 4. Interruptions

| ID | Steps | Expected |
|----|-------|----------|
| I1 | iOS: enable a Focus mode with no allowed apps, Time Sensitive notifications allowed (default). | Alert breaks through as Time Sensitive. |
| I2 | iOS: Focus mode with Time Sensitive turned off for the app. | Alert is delivered silently to Notification Center (expected OS behaviour). Reliability screen explains how to allow it. |
| I3 | Android: Do Not Disturb on (priority only). | Alert behaviour follows the user's DND settings; note what happens. The timer state is still correct when the app is opened. |
| I4 | Ring/silent switch on (iOS) or ringer on vibrate (Android). | No sound, vibration if enabled, banner shown. |
| I5 | Android: screen off, `adb shell dumpsys deviceidle force-idle`, wait for the end. | Alert on time (alarm-clock alarms are allowed in Doze). |
| I6 | Android: Battery Saver on, screen off for a whole phase. | Alert on time. |
| I7 | Reboot the phone during a running phase. | Alert still arrives at the original time (Android re-registers alarms after boot; iOS keeps pending notifications). |
| I8 | Set the clock back 1 hour during a phase. | Display never shows more than the phase length; the phase continues. |

## 5. Notification actions (Android)

| ID | Steps | Expected |
|----|-------|----------|
| N1 | While running, open the shade. | Ongoing notification "Ends at HH:MM" with Pause, Skip, Stop. No sound. |
| N2 | Tap Pause in the notification. | App opens, timer paused; notification shows "Paused · MM:SS left" with Resume and Stop; no alert at the old end time. |
| N3 | Swipe the app away while paused, tap Resume in the notification. | App opens and resumes; alert at the new end time. |
| N4 | Let a phase end with the shade open. | The ongoing notification is replaced by the alert, which rings (the replacement must still play the sound and vibrate). |
| N5 | Tap Stop on a notification for a phase that has just ended. | The ended phase is credited as completed, not recorded as abandoned. |

## 6. Phone makers (Android)

Repeat C2, C4, A1 and I5 on each of these if available, with default battery settings first, then with the app set to "Unrestricted" / "No restrictions":

| Maker | Where to look | Notes |
|-------|---------------|-------|
| Samsung (One UI) | Settings → Battery → Background usage limits (Sleeping / Deep sleeping apps) | Deep sleeping apps lose alarms. |
| Xiaomi / Redmi / POCO (HyperOS, MIUI) | App info → Battery saver → No restrictions; Autostart on | Swiping from recents may force-stop the app on some versions, which cancels all alarms until the app is opened again (it re-arms on launch). |
| Huawei / Honor, OnePlus, Oppo, Vivo | See dontkillmyapp.com (linked from the reliability screen) | Record the result. |

## Results

| Date | Tester | Device | OS | Build | Failed cases | Notes |
|------|--------|--------|----|-------|--------------|-------|
| | | | | | | |
