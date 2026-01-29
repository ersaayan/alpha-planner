import { View, StyleSheet } from 'react-native';
import { Text } from '@ui-kitten/components';

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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <View style={styles.container}>
        <Text category="s1" style={{ marginBottom: Spacing.md }}>
          {title}
        </Text>
        <View style={styles.emptyState}>
          <Text category="c1" style={{ color: colors.textMuted }}>
            No data yet
          </Text>
        </View>
      </View>
    );
  }

  const defaultFormat = (value: number) => {
    const minutes = Math.floor(value / 60);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
    return `${minutes}m`;
  };

  const format = formatValue ?? defaultFormat;

  return (
    <View style={styles.container}>
      <Text category="s1" style={{ marginBottom: Spacing.md }}>
        {title}
      </Text>

      {/* Progress Bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          if (percentage === 0) return null;
          return (
            <View
              key={index}
              style={[
                styles.progressSegment,
                {
                  width: `${percentage}%`,
                  backgroundColor: item.color,
                  borderTopLeftRadius: index === 0 ? BorderRadius.full : 0,
                  borderBottomLeftRadius: index === 0 ? BorderRadius.full : 0,
                  borderTopRightRadius: index === data.length - 1 ? BorderRadius.full : 0,
                  borderBottomRightRadius: index === data.length - 1 ? BorderRadius.full : 0,
                },
              ]}
            />
          );
        })}
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
