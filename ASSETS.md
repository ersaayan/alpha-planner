# Assets and third-party licences

The source code of Alpha Planner is released under the [MIT License](LICENSE). That licence covers the code only. Images, sounds and fonts are separate works and may have their own terms, listed here.

> **Status:** the provenance and licences of the bundled images and sound are **not yet documented**. Until the owner confirms them, treat them as *all rights reserved* and do not assume you may reuse them in a fork or another project.

## Bundled media

| File | Used for | Source | Licence |
|------|----------|--------|---------|
| `assets/images/icon.png` | App icon (1024×1024) | TODO(owner) | TODO(owner) |
| `assets/images/adaptive-icon.png` | Android adaptive icon foreground | TODO(owner) | TODO(owner) |
| `assets/images/notification-icon.png` | Android notification icon and monochrome icon | TODO(owner) | TODO(owner) |
| `assets/images/splash-icon.png` | Splash screen | TODO(owner) | TODO(owner) |
| `assets/sounds/timer_complete.wav` | Notification sound when a Pomodoro phase ends | TODO(owner) | TODO(owner) |

### Action required (maintainer)

- Confirm that the **app icon** (and the images derived from it) may be redistributed under a licence compatible with an open-source release and with the App Store and Google Play. If the icon was generated with an AI image tool, check that tool's terms of use for commercial use and redistribution, and state it here.
- Confirm that the **timer sound** is redistributable, or replace it with a [CC0](https://creativecommons.org/publicdomain/zero/1.0/) or otherwise permissively licensed sound.
- If an asset cannot be cleared, replace it with an original or CC0 asset, and update the table above with the source and licence of the replacement.
- Contributors: any new asset must have a compatible licence, and you must add a row to this table in the same pull request.

## Fonts

| Font | Source | Licence |
|------|--------|---------|
| Inter (weights 300–800) | Loaded through the [`@expo-google-fonts/inter`](https://www.npmjs.com/package/@expo-google-fonts/inter) package from [rsms/inter](https://github.com/rsms/inter) | Font: [SIL Open Font License 1.1](https://openfontlicense.org/) · npm package: MIT |

## Icons

| Icon set | Source | Licence |
|----------|--------|---------|
| Feather | via [`@expo/vector-icons`](https://github.com/expo/vector-icons) | MIT |
| Material Icons | via `@expo/vector-icons` | Apache-2.0 |
| Material Design Icons (`MaterialCommunityIcons`) | via `@expo/vector-icons` | Apache-2.0 |
| SF Symbols | via [`expo-symbols`](https://docs.expo.dev/versions/latest/sdk/symbols/), iOS only | Apple's SF Symbols licence: usable only in apps for Apple platforms |

## Other dependencies

npm dependencies keep their own licences, which you can inspect in `node_modules/<package>/LICENSE` after `npm ci` or with a tool such as `npx license-checker`.
