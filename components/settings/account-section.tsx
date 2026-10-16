import { Button, Card, Divider, Text } from '@ui-kitten/components';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAuthErrorKey } from '@/services/supabase/auth-errors';
import { isSyncConfigured } from '@/services/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { resetAllData } from '@/stores/reset-all-data';
import { useSyncStore } from '@/stores/sync-store';

/**
 * Optional sync account. Renders nothing unless this build has Supabase configured
 * (store builds do not), so the app never asks for an account.
 */
export function AccountSection() {
  return isSyncConfigured ? <SyncAccountCard /> : null;
}

function SyncAccountCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const isSignedIn = useAuthStore((state) => state.status === 'signedIn');
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const isLoading = useAuthStore((state) => state.isLoading);
  const signOut = useAuthStore((state) => state.signOut);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const pendingCount = useSyncStore((state) => state.pendingOperations.length);

  const eraseLocalData = () => {
    // Also signs out. Back to first launch: the onboarding guard takes over navigation.
    resetAllData().catch(() => {
      Alert.alert(t('common.error'), t('settings.resetFailed'));
    });
  };

  const handleSignOut = () => {
    const message =
      pendingCount > 0
        ? `${t('auth.signOutConfirm')}\n\n${t('auth.signOutPending', { count: pendingCount })}`
        : t('auth.signOutConfirm');
    Alert.alert(t('auth.signOutTitle'), message, [
      { text: t('common.cancel'), style: 'cancel' },
      // Never throws and works offline; the user stays in Settings, signed out.
      { text: t('auth.signOutKeepData'), onPress: () => void signOut() },
      { text: t('auth.signOutEraseData'), style: 'destructive', onPress: eraseLocalData },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('auth.deleteAccountTitle'), t('auth.deleteAccountMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.deleteAccount'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount();
          } catch (error) {
            Alert.alert(t('auth.deleteAccountFailed'), t(getAuthErrorKey(error)));
            return;
          }
          try {
            await resetAllData();
          } finally {
            Alert.alert(t('auth.deleteAccountDone'));
          }
        },
      },
    ]);
  };

  return (
    <>
      <Text category="s1" style={styles.sectionTitle}>
        {t('settings.sync')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        {isSignedIn && user ? (
          <>
            <View style={styles.row}>
              <View style={styles.info}>
                <Text category="s2" style={{ color: colors.text }}>
                  {profile?.displayName ?? user.email ?? t('settings.user')}
                </Text>
                <Text category="c1" style={{ color: colors.textMuted }}>
                  {t('settings.signedInAs', { email: user.email ?? '' })}
                </Text>
                {pendingCount > 0 ? (
                  <Text category="c1" style={{ color: colors.textMuted }}>
                    {t('settings.pendingChanges', { count: pendingCount })}
                  </Text>
                ) : null}
              </View>
              <Icon name="person-outline" fill={colors.textMuted} size={24} />
            </View>

            <Divider style={styles.divider} />

            <Button
              appearance="ghost"
              status="basic"
              accessoryLeft={(props) => <Icon {...props} name="log-out-outline" />}
              onPress={handleSignOut}
              disabled={isLoading}
              style={styles.leftButton}
            >
              {t('auth.signOut')}
            </Button>

            <Divider style={styles.divider} />

            <Button
              appearance="ghost"
              status="danger"
              accessoryLeft={(props) => <Icon {...props} name="trash-2-outline" />}
              onPress={handleDeleteAccount}
              disabled={isLoading}
              style={styles.leftButton}
            >
              {t('auth.deleteAccount')}
            </Button>
          </>
        ) : (
          <>
            <Text category="c1" style={[styles.description, { color: colors.textMuted }]}>
              {t('settings.syncDesc')}
            </Text>
            <Button
              appearance="ghost"
              status="primary"
              accessoryLeft={(props) => <Icon {...props} name="sync-outline" />}
              onPress={() => router.push('/(auth)/login' as never)}
              style={styles.leftButton}
            >
              {t('settings.signInToSync')}
            </Button>
          </>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  info: {
    flex: 1,
  },
  description: {
    marginBottom: Spacing.sm,
  },
  divider: {
    marginVertical: Spacing.sm,
  },
  leftButton: {
    justifyContent: 'flex-start',
  },
});
