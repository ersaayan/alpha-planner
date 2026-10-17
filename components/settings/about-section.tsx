import { Card, Divider, Text } from '@ui-kitten/components';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { LINKS } from '@/constants/links';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAppVersion } from '@/utils/app-version';

const ROWS = [
  { key: 'privacy', icon: 'shield-outline', titleKey: 'about.privacyPolicy', descKey: 'about.privacyPolicyDesc', url: LINKS.privacyPolicy },
  { key: 'source', icon: 'github', titleKey: 'about.sourceCode', descKey: 'about.sourceCodeDesc', url: LINKS.sourceCode },
  { key: 'license', icon: 'file-text-outline', titleKey: 'about.license', descKey: 'about.licenseDesc', url: LINKS.license },
  { key: 'bug', icon: 'message-square-outline', titleKey: 'about.reportBug', descKey: 'about.reportBugDesc', url: LINKS.reportBug },
] as const;

/**
 * Settings → About: the privacy policy (required in-app by both stores), the source
 * code and license (MIT, open source), a bug report link, and the installed version.
 */
export function AboutSection() {
  const { t } = useTranslation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const { version, build } = getAppVersion();

  const open = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert(t('common.error'), t('about.openFailed', { url })));
  };

  return (
    <>
      <Text category="s1" style={styles.sectionTitle} accessibilityRole="header">
        {t('about.title')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        {ROWS.map((row, index) => (
          <Fragment key={row.key}>
            {index > 0 && <Divider style={styles.divider} />}
            <Pressable
              onPress={() => open(row.url)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="link"
              accessibilityHint={t('about.opensInBrowser')}
              testID={`about-${row.key}`}
            >
              <View style={[styles.iconBubble, { backgroundColor: colors.primary + '20' }]}>
                <Icon name={row.icon} fill={colors.primary} size={20} />
              </View>
              <View style={styles.rowText}>
                <Text category="s1">{t(row.titleKey)}</Text>
                <Text category="c1" style={{ color: colors.textMuted }}>
                  {t(row.descKey)}
                </Text>
              </View>
              <Icon name="external-link" fill={colors.textMuted} size={18} />
            </Pressable>
          </Fragment>
        ))}

        <Divider style={styles.divider} />
        <View style={styles.versionRow} accessible>
          <Text category="s1">{t('about.version')}</Text>
          <Text category="c1" style={{ color: colors.textSecondary }} testID="about-version">
            {build ? t('about.versionWithBuild', { version, build }) : version}
          </Text>
        </View>
      </Card>
      <Text category="c1" style={[styles.footer, { color: colors.textMuted }]}>
        {t('about.madeWith')}
      </Text>
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
    minHeight: 48,
    paddingVertical: Spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  divider: {
    marginVertical: Spacing.sm,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  footer: {
    textAlign: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
