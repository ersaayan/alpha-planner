import * as Application from 'expo-application';
import Constants from 'expo-constants';

/**
 * The installed app's version ("1.0.0") and build number (CFBundleVersion /
 * versionCode, set by EAS), read from the native app. Outside a native build (web,
 * tests) the version falls back to app.json and there is no build number.
 */
export function getAppVersion(): { version: string; build: string | null } {
  return {
    version: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0',
    build: Application.nativeBuildVersion ?? null,
  };
}
