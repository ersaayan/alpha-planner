import { Text } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ScreenHeader } from '@/components/common/screen-header';
import { BorderRadius, Colors, FontSize, InterFonts, Spacing } from '@/constants/theme';
import { useAlertPermissions } from '@/hooks/use-alert-permissions';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  dontKillMyAppUrl,
  openAppSettings,
  openBatteryOptimizationSettings,
  openChannelSettings,
  requestExactAlarmPermission,
  requestNotificationPermission,
} from '@/services/notifications/alert-permissions';
import { alertChannelId, scheduleTestAlert } from '@/services/notifications/pomodoro-alerts';
import { usePomodoroStore, useSettingsStore } from '@/stores';

type Tone = 'ok' | 'warning' | 'info';

interface CheckRowProps {
  title: string;
  status: string;
  tone: Tone;
  actionLabel?: string;
  onAction?: () => void;
}

function CheckRow({ title, status, tone, actionLabel, onAction }: CheckRowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const toneColor = tone === 'ok' ? colors.success : tone === 'warning' ? colors.warning : colors.textMuted;
  const icon = tone === 'ok' ? 'checkmark-circle-2' : tone === 'warning' ? 'alert-triangle' : 'info';

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Icon name={icon} fill={toneColor} style={styles.rowIcon} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowStatus, { color: colors.textSecondary }]}>{status}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={[styles.rowButton, { borderColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${title}`}
        >
          <Text style={[styles.rowButtonText, { color: colors.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function NotificationReliabilityScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { permissions, refresh } = useAlertPermissions();
  const refreshAlerts = usePomodoroStore((state) => state.refreshAlerts);
  const soundEnabled = useSettingsStore((state) => state.settings.soundEnabled);
  const vibrationEnabled = useSettingsStore((state) => state.pomodoroSettings.vibrationEnabled);
  const isAndroid = Platform.OS === 'android';

  const askForNotifications = async () => {
    if (permissions?.notifications === 'denied' && !permissions.canAskAgain) {
      await openAppSettings();
    } else {
      await requestNotificationPermission().catch(() => undefined);
      refreshAlerts();
    }
    void refresh();
  };

  const askForExactAlarms = async () => {
    const granted = await requestExactAlarmPermission();
    // Alarms scheduled without the permission are inexact; schedule them again.
    if (granted) refreshAlerts();
    void refresh();
  };

  const sendTestAlert = async () => {
    if (permissions?.notifications !== 'granted') {
      await askForNotifications();
    }
    const { settings, pomodoroSettings } = useSettingsStore.getState();
    try {
      await scheduleTestAlert({
        timer: usePomodoroStore.getState().timer,
        pomodoroSettings,
        notificationsEnabled: true,
        soundEnabled: settings.soundEnabled,
        use24HourClock: settings.timeFormat !== '12h',
      });
      Alert.alert(t('reliability.testAlert'), t('reliability.testAlertScheduled'));
    } catch {
      Alert.alert(t('common.error'), t('reliability.permissionDenied'));
    }
  };

  const notificationStatus =
    permissions?.notifications === 'granted'
      ? t('reliability.permissionGranted')
      : permissions?.notifications === 'denied'
        ? t('reliability.permissionDenied')
        : t('reliability.permissionUndetermined');

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScreenHeader title={t('reliability.title')} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>{t('reliability.intro')}</Text>

        <CheckRow
          title={t('reliability.permission')}
          status={notificationStatus}
          tone={permissions?.notifications === 'granted' ? 'ok' : 'warning'}
          actionLabel={permissions && permissions.notifications !== 'granted' ? t('reliability.fix') : undefined}
          onAction={askForNotifications}
        />

        {isAndroid && permissions?.alertChannelEnabled !== null && permissions?.alertChannelEnabled !== undefined && (
          <CheckRow
            title={t('reliability.channel')}
            status={
              permissions.alertChannelEnabled
                ? t('reliability.channelEnabled')
                : t('reliability.channelDisabled')
            }
            tone={permissions.alertChannelEnabled ? 'ok' : 'warning'}
            actionLabel={permissions.alertChannelEnabled ? undefined : t('reliability.fix')}
            onAction={() => openChannelSettings(alertChannelId(soundEnabled, vibrationEnabled))}
          />
        )}

        {isAndroid && permissions && (
          <CheckRow
            title={t('reliability.exactAlarms')}
            status={
              permissions.exactAlarms
                ? t('reliability.exactAlarmsGranted')
                : t('reliability.exactAlarmsDenied')
            }
            tone={permissions.exactAlarms ? 'ok' : 'warning'}
            actionLabel={permissions.exactAlarms ? undefined : t('reliability.fix')}
            onAction={askForExactAlarms}
          />
        )}

        {isAndroid && (
          <CheckRow
            title={t('reliability.battery')}
            status={t('reliability.batteryDesc')}
            tone="info"
            actionLabel={t('reliability.open')}
            onAction={() => void openBatteryOptimizationSettings()}
          />
        )}

        {isAndroid && (
          <CheckRow
            title={t('reliability.manufacturer')}
            status={t('reliability.manufacturerDesc')}
            tone="info"
            actionLabel={t('reliability.open')}
            onAction={() => void Linking.openURL(dontKillMyAppUrl())}
          />
        )}

        {Platform.OS === 'ios' && (
          <CheckRow
            title={t('reliability.focusModes')}
            status={t('reliability.focusModesDesc')}
            tone="info"
            actionLabel={t('reliability.open')}
            onAction={() => void openAppSettings()}
          />
        )}

        <CheckRow
          title={t('reliability.testAlert')}
          status={t('reliability.testAlertDesc')}
          tone="info"
          actionLabel={t('reliability.send')}
          onAction={() => void sendTestAlert()}
        />

        <Pressable
          onPress={() => void refresh()}
          style={[styles.refreshButton, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
        >
          <Text style={[styles.refreshText, { color: colors.onPrimary }]}>{t('reliability.refresh')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  intro: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  rowIcon: {
    width: 22,
    height: 22,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.md,
  },
  rowStatus: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
  },
  rowButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  rowButtonText: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.sm,
  },
  refreshButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  refreshText: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.md,
  },
});
