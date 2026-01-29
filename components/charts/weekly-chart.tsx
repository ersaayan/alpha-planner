import { View, StyleSheet } from 'react-native';
import { Text } from '@ui-kitten/components';
import { format, subDays, isSameDay } from 'date-fns';

import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface DayData {
  date: Date;
  value: number;
}

interface WeeklyChartProps {
  data: DayData[];
  title: string;
  valueLabel?: string;
  barColor?: string;
}

export function WeeklyChart({ data, title, valueLabel = 'sessions', barColor }: WeeklyChartProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const chartBarColor = barColor ?? colors.primary;

  // Get last 7 days
  const today = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i);
    const dayData = data.find((d) => isSameDay(d.date, date));
    return {
      date,
      value: dayData?.value ?? 0,
      label: format(date, 'EEE').charAt(0),
      isToday: isSameDay(date, today),
    };
  });

  // Find max value for scaling
  const maxValue = Math.max(...last7Days.map((d) => d.value), 1);

  // Calculate total for the week
  const weekTotal = last7Days.reduce((sum, d) => sum + d.value, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text category="s1">{title}</Text>
        <Text category="c1" style={{ color: colors.textMuted }}>
          {weekTotal} {valueLabel} this week
        </Text>
      </View>

      <View style={styles.chartContainer}>
        {last7Days.map((day, index) => (
          <View key={index} style={styles.barContainer}>
            <View style={styles.barWrapper}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${Math.max((day.value / maxValue) * 100, 5)}%`,
                    backgroundColor: day.value > 0 ? chartBarColor : colors.border,
                    opacity: day.isToday ? 1 : 0.7,
                  },
                ]}
              />
            </View>
            <Text
              category="c2"
              style={[
                styles.dayLabel,
                {
                  color: day.isToday ? colors.primary : colors.textMuted,
                  fontWeight: day.isToday ? 'bold' : 'normal',
                },
              ]}
            >
              {day.label}
            </Text>
            {day.value > 0 && (
              <Text category="c2" style={{ color: colors.textMuted, fontSize: 10 }}>
                {day.value}
              </Text>
            )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    width: '60%',
    height: 80,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: BorderRadius.sm,
    minHeight: 4,
  },
  dayLabel: {
    marginTop: Spacing.xs,
  },
});
