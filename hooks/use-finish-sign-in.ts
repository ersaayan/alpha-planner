import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import type { SignInResult } from '@/stores/auth-store';
import { resetAllData } from '@/stores/reset-all-data';

/**
 * After a successful sign-in: close the sign-in modal. If a different account than
 * the last one used this device, first ask whether to keep the local data.
 */
export function useFinishSignIn() {
  const router = useRouter();
  const { t } = useTranslation();

  const close = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  return useCallback(
    (result: SignInResult) => {
      if (!result.switchedAccount) {
        close();
        return;
      }
      Alert.alert(
        t('auth.switchAccountTitle'),
        t('auth.switchAccountMsg'),
        [
          { text: t('auth.keepLocalData'), onPress: close },
          {
            text: t('auth.eraseLocalData'),
            style: 'destructive',
            // Back to first launch; the onboarding guard takes over navigation.
            onPress: () => {
              resetAllData({ keepSignedIn: true }).catch(() => {
                Alert.alert(t('common.error'), t('settings.resetFailed'));
              });
            },
          },
        ],
        { cancelable: false }
      );
    },
    [close, t]
  );
}

/** Closes the sign-in modal without signing in. */
export function useCloseAuth() {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);
}
