import { Text } from '@ui-kitten/components';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AnimatedCard } from '@/components/animated/animated-card';
import { Icon } from '@/components/icon';
import { BorderRadius, Colors, FontSize, InterFonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettingsStore } from '@/stores/settings-store';
import type { DashboardCardId } from '@/types';

interface CollapsibleCardProps {
  /** Which Dashboard card this is; its folded state is saved in the settings. */
  id: DashboardCardId;
  icon: string;
  /** Icon color; the icon sits on a 12% tint of it. */
  accent: string;
  title: string;
  /** Second line under the title (e.g. when the season ends). */
  subtitle?: string;
  /** Short status on the right, also shown when folded (e.g. "2/3"). */
  summary?: string;
  summaryColor?: string;
  /** A control next to the header (outside the fold button), e.g. an info button. */
  accessory?: ReactNode;
  children: ReactNode;
  testID?: string;
}

/**
 * A Dashboard card that folds to its header. The header is one button with the
 * expanded state for screen readers; the content is only rendered when unfolded.
 */
export function CollapsibleCard({
  id,
  icon,
  accent,
  title,
  subtitle,
  summary,
  summaryColor,
  accessory,
  children,
  testID,
}: CollapsibleCardProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const collapsed = useSettingsStore((state) => state.settings.collapsedDashboardCards.includes(id));
  const toggle = useSettingsStore((state) => state.toggleDashboardCard);

  return (
    <AnimatedCard variant="default" style={styles.card} contentStyle={styles.content} testID={testID}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => toggle(id)}
          style={({ pressed }) => [styles.header, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={[title, subtitle, summary].filter(Boolean).join(', ')}
          accessibilityState={{ expanded: !collapsed }}
          testID={testID ? `${testID}-toggle` : undefined}
        >
          <View style={[styles.iconBubble, { backgroundColor: accent + '20' }]}>
            <Icon name={icon} fill={accent} size={18} />
          </View>
          <View style={styles.titles}>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header" numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {summary ? (
            <Text style={[styles.summary, { color: summaryColor ?? colors.textSecondary }]}>{summary}</Text>
          ) : null}
          <Icon name={collapsed ? 'chevron-down' : 'chevron-up'} fill={colors.textMuted} size={20} />
        </Pressable>
        {accessory}
      </View>

      {collapsed ? null : (
        <Animated.View entering={FadeIn.duration(180)} style={styles.body}>
          {children}
        </Animated.View>
      )}
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  content: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  header: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 48,
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
  titles: {
    flex: 1,
  },
  title: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.md,
  },
  subtitle: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  summary: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.sm,
  },
  body: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
});
