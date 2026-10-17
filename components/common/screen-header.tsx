import { Text } from '@ui-kitten/components';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Colors, FontSize, InterFonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ScreenHeaderProps {
  title: string;
  /** Optional control on the right (keeps the title centred when absent). */
  right?: ReactNode;
}

/**
 * Header for full-screen views without a native header (kanban, calendar, timeline,
 * notification reliability): a labelled 44pt back button and the title as a header.
 */
export function ScreenHeader({ title, right }: ScreenHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? 'light'];

  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        style={styles.side}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
      >
        <Icon name="arrow-back-outline" fill={colors.text} style={styles.icon} />
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  side: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 24,
    height: 24,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: InterFonts.bold,
    fontSize: FontSize.xl,
  },
});
