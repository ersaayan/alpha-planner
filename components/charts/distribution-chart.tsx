import { View, StyleSheet } from 'react-native';
import { Text } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface DistributionItem {
  label: string;
  value: number;
  color: string;
}

interface DistributionChartProps {
  data: DistributionItem[];
  title: string;
  formatValue?: (value: number) => string;
}

export function DistributionChart({ data, title, formatValue }: DistributionChartProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const total = data.reduce((sum, item) => sum + (Number.isFinite(item.value) && item.value > 0 ? item.value : 0), 0);

  if (total === 0) {
    return (
      <View style={styles.container}>
        <Text category="s1" style={{ marginBottom: Spacing.md }}>
          {title}
        </Text>
        <View style={styles.emptyState}>
          <Text category="c1" style={{ color: colors.textMuted }}>
            {t('stats.newUser')}
          </Text>
        </View>
      </View>
    );
  }

  const defaultFormat = (value: number) => {
    const minutes = Math.floor(value / 60);
    return t('summary.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  };

  const format = formatValue ?? defaultFormat;

  return (
    <View style={styles.container}>
      <Text category="s1" style={{ marginBottom: Spacing.md }}>
        {title}
      </Text>

      {/* Progress Bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        {(() => {
          const visibleSegments = data
            .map((item, index) => ({ ...item, originalIndex: index }))
            .filter((item) => item.value > 0);

          return visibleSegments.map((item, visibleIndex) => {
            const percentage = (item.value / total) * 100;
            const isFirst = visibleIndex === 0;
            const isLast = visibleIndex === visibleSegments.length - 1;
            return (
              <Animated.View
                key={item.originalIndex}
                entering={FadeIn.delay(visibleIndex * 100).duration(300)}
                accessible={true}
                accessibilityLabel={`${item.label}: ${format(item.value)}, ${Math.round(percentage)}%`}
                style={[
                  styles.progressSegment,
                  {
                    width: `${percentage}%`,
                    backgroundColor: item.color,
                    borderTopLeftRadius: isFirst ? BorderRadius.full : 0,
                    borderBottomLeftRadius: isFirst ? BorderRadius.full : 0,
                    borderTopRightRadius: isLast ? BorderRadius.full : 0,
                    borderBottomRightRadius: isLast ? BorderRadius.full : 0,
                  },
                ]}
              />
            );
          });
        })()}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {data.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <View style={styles.legendText}>
              <Text category="c1">{item.label}</Text>
              <Text category="c2" style={{ color: colors.textMuted }}>
                {format(item.value)} ({Math.round((item.value / total) * 100)}%)
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.sm,
  },
  progressBar: {
    height: 12,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressSegment: {
    height: '100%',
  },
  legend: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },
  legendText: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
});
