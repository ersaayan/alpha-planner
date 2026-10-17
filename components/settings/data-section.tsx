import { Card, Divider, Text } from '@ui-kitten/components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AnimatedButton } from '@/components/animated/animated-button';
import { SheetModal } from '@/components/common/sheet-modal';
import { Icon } from '@/components/icon';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  describeBackup,
  exportBackup,
  pickBackup,
  restoreBackup,
  type BackupError,
  type BackupFile,
} from '@/services/data/backup';
import { useSettingsStore } from '@/stores';
import { formatDate } from '@/utils/date';

type Dialog =
  | { kind: 'confirm'; backup: BackupFile }
  | { kind: 'message'; title: string; body: string }
  | null;

const ERROR_KEYS: Record<BackupError, string> = {
  unreadable: 'data.errorUnreadable',
  notBackup: 'data.errorNotBackup',
  newerVersion: 'data.errorNewerVersion',
  empty: 'data.errorEmpty',
};

/**
 * Settings → Data: export everything to a file (share sheet), import a file to replace
 * the data on this device. The app keeps data only on the device, so this is the backup.
 */
export function DataSection() {
  const { t } = useTranslation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const dateFormat = useSettingsStore((state) => state.settings.dateFormat);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const handleExport = async () => {
    setBusy('export');
    try {
      await exportBackup(t('data.exportTitle'));
    } catch {
      setDialog({ kind: 'message', title: t('data.exportFailedTitle'), body: t('data.exportFailed') });
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    setBusy('import');
    try {
      const result = await pickBackup();
      if (!result) return;
      if (!result.ok) {
        setDialog({ kind: 'message', title: t('data.importFailedTitle'), body: t(ERROR_KEYS[result.error]) });
        return;
      }
      setDialog({ kind: 'confirm', backup: result.backup });
    } catch {
      setDialog({ kind: 'message', title: t('data.importFailedTitle'), body: t('data.errorUnreadable') });
    } finally {
      setBusy(null);
    }
  };

  const confirmImport = async (backup: BackupFile) => {
    setDialog(null);
    setBusy('import');
    try {
      await restoreBackup(backup);
      setDialog({ kind: 'message', title: t('data.importDoneTitle'), body: t('data.importDone') });
    } catch {
      setDialog({ kind: 'message', title: t('data.importFailedTitle'), body: t('data.errorUnreadable') });
    } finally {
      setBusy(null);
    }
  };

  const summary = dialog?.kind === 'confirm' ? describeBackup(dialog.backup) : null;
  const exportedOn = summary?.exportedAt ? formatDate(new Date(summary.exportedAt), dateFormat) : '';

  const row = (key: 'export' | 'import', icon: string, title: string, description: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={busy !== null}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
    >
      <Icon name={icon} fill={colors.primary} style={styles.icon} />
      <View style={styles.rowText}>
        <Text category="s1">{title}</Text>
        <Text category="c1" style={{ color: colors.textMuted }}>
          {description}
        </Text>
      </View>
      {busy === key ? <ActivityIndicator color={colors.primary} /> : null}
    </Pressable>
  );

  return (
    <>
      <Text category="s1" style={styles.sectionTitle}>
        {t('data.title')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        {row('export', 'upload-outline', t('data.export'), t('data.exportDesc'), handleExport)}
        <Divider style={styles.divider} />
        {row('import', 'download-outline', t('data.import'), t('data.importDesc'), handleImport)}
      </Card>

      <SheetModal
        visible={dialog?.kind === 'confirm'}
        title={t('data.confirmTitle')}
        onClose={() => setDialog(null)}
        footer={
          <>
            <AnimatedButton title={t('common.cancel')} variant="ghost" size="sm" onPress={() => setDialog(null)} />
            <AnimatedButton
              title={t('data.replace')}
              variant="danger"
              size="sm"
              onPress={() => dialog?.kind === 'confirm' && confirmImport(dialog.backup)}
            />
          </>
        }
      >
        {summary ? (
          <>
            <Text category="p2">{t('data.confirmBody')}</Text>
            <Text category="c1" style={{ color: colors.textSecondary }}>
              {t('data.backupSummary', {
                date: exportedOn,
                todos: summary.todos,
                achievements: summary.achievements,
              })}
            </Text>
          </>
        ) : null}
      </SheetModal>

      <SheetModal
        visible={dialog?.kind === 'message'}
        title={dialog?.kind === 'message' ? dialog.title : ''}
        onClose={() => setDialog(null)}
        footer={<AnimatedButton title={t('common.ok')} size="sm" onPress={() => setDialog(null)} />}
      >
        {dialog?.kind === 'message' ? <Text category="p2">{dialog.body}</Text> : null}
      </SheetModal>
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
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 44,
    paddingVertical: Spacing.xs,
  },
  rowText: {
    flex: 1,
  },
  icon: {
    width: 22,
    height: 22,
  },
  divider: {
    marginVertical: Spacing.sm,
  },
});
