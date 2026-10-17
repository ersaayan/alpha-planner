import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import { Text } from '@ui-kitten/components';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { format, subDays, isSameDay } from 'date-fns';
import { getDateLocale } from '@/utils/locale';

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

/** The last 7 days (today included), one bar per day. Days without data show an empty bar. */
export function WeeklyChart({ data, title, valueLabel = '', barColor }: WeeklyChartProps) {
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const chartBarColor = barColor ?? colors.primary;

  // Get last 7 days with memoized computation
  const { last7Days, maxValue, weekTotal } = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(today, 6 - i);
      const value = data
        .filter((d) => isSameDay(d.date, date))
        .reduce((sum, d) => sum + (Number.isFinite(d.value) ? d.value : 0), 0);
      return {
        date,
        value,
        label: format(date, 'EEEEEE', { locale }),
        isToday: isSameDay(date, today),
      };
    });

    const max = Math.max(...days.map((d) => d.value), 1);
    const total = days.reduce((sum, d) => sum + d.value, 0);

    return { last7Days: days, maxValue: max, weekTotal: total };
  }, [data, locale]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text category="s1">{title}</Text>
        <Text category="c1" style={{ color: colors.textMuted }}>
          {t('charts.lastSevenDays', { count: weekTotal, unit: valueLabel })}
        </Text>
      </View>

      <View style={styles.chartContainer}>
        {last7Days.map((day, index) => (
          <View key={index} style={styles.barContainer}>
            <View style={styles.barWrapper}>
              <Animated.View
                entering={FadeInUp.delay(index * 80).duration(400)}
                accessible={true}
                accessibilityLabel={`${format(day.date, 'EEEE', { locale })}: ${day.value} ${valueLabel}`}
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
