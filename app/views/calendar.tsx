import { Icon } from '@/components/icon';
import { ScreenHeader } from '@/components/common/screen-header';
import { EmptyState } from '@/components/common';
import { Card, Text } from '@ui-kitten/components';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { STATUS_LABEL_KEYS } from '@/constants/todo-options';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCategoryStore, useSettingsStore, useTodoStore } from '@/stores';
import type { Todo } from '@/types';
import { getDueDateKey } from '@/utils/todo-dates';
import { formatLocalized, getDateLocale, resolveWeekStart } from '@/utils/locale';

export default function CalendarScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const weekStartSetting = useSettingsStore((state) => state.settings.weekStartsOn);
  const weekStartsOn = resolveWeekStart(weekStartSetting, i18n.language);
  const locale = getDateLocale(i18n.language);

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const todos = useTodoStore((state) => state.todos);
  const categories = useCategoryStore((state) => state.categories);

  const getCategoryColor = (categoryId: string | null): string => {
    if (!categoryId) return colors.primary;
    const category = categories.find((c) => c.id === categoryId);
    return category?.color ?? colors.primary;
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn });
    const endDate = endOfWeek(monthEnd, { weekStartsOn });

    const days: Date[] = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  }, [currentMonth, weekStartsOn]);

  // Build a map of date -> todos for efficient lookups
  const todosByDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    todos.forEach((todo) => {
      // Archived tasks are put away; they do not belong on the calendar.
      if (!todo.dueDate || todo.status === 'archived') return;
      const dateKey = getDueDateKey(todo.dueDate);
      if (!dateKey) return;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(todo);
    });
    return map;
  }, [todos]);

  // Get todos for a specific date
  const getTodosForDate = (date: Date): Todo[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return todosByDate.get(dateKey) ?? [];
  };

  // Get todos for selected date
  const selectedDateTodos = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return todosByDate.get(dateKey) ?? [];
  }, [selectedDate, todosByDate]);

  // Weekday headers in the user's language, starting on the right day.
  const weekdayLabels = useMemo(() => {
    const first = startOfWeek(new Date(), { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => format(addDays(first, i), 'EEEEEE', { locale }));
  }, [weekStartsOn, locale]);

  // A day selected in another month is not carried over.
  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
    setSelectedDate(null);
  };

  const handleDatePress = (date: Date) => {
    setSelectedDate(isSameDay(date, selectedDate ?? new Date(0)) ? null : date);
  };

  const handleTodoPress = (todoId: string) => {
    router.push(`/todo/${todoId}`);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader title={t('views.calendar')} />

      {/* One scroll view for the month and the day's tasks: fits small phones and large text. */}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <Pressable onPress={handlePrevMonth} style={styles.navButton} accessibilityRole="button" accessibilityLabel={t('views.previousMonth')}>
            <Icon name="arrow-back-outline" fill={colors.text} size={20} />
          </Pressable>
          <Pressable
            onPress={() => {
              setCurrentMonth(new Date());
              setSelectedDate(new Date());
            }}
            style={styles.monthTitle}
            accessibilityRole="button"
            accessibilityHint={t('views.goToTodayHint')}
          >
            <Text category="h6">{formatLocalized(currentMonth, 'LLLL yyyy', i18n.language)}</Text>
          </Pressable>
          <Pressable onPress={handleNextMonth} style={styles.navButton} accessibilityRole="button" accessibilityLabel={t('views.nextMonth')}>
            <Icon name="arrow-forward-outline" fill={colors.text} size={20} />
          </Pressable>
        </View>

        {/* Weekday Headers */}
        <View style={styles.weekdaysRow}>
          {weekdayLabels.map((day) => (
            <View key={day} style={styles.weekdayCell}>
              <Text category="c2" style={{ color: colors.textMuted }}>
                {day}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {calendarDays.map((day, index) => {
            const dayTodos = getTodosForDate(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isDayToday = isSameDay(day, new Date());
            const dayLabel = [
              format(day, 'EEEE, d MMMM', { locale }),
              t('views.taskCount', { count: dayTodos.length }),
              isDayToday ? t('common.today') : null,
            ]
              .filter(Boolean)
              .join(', ');

            return (
              <Pressable
                key={index}
                style={[
                  styles.dayCell,
                  !isCurrentMonth && styles.otherMonthDay,
                  isSelected && { backgroundColor: colors.primary + '20' },
                ]}
                onPress={() => handleDatePress(day)}
                accessibilityRole="button"
                accessibilityLabel={dayLabel}
                accessibilityState={{ selected: isSelected ?? false }}
              >
                <Text
                  category="s2"
                  style={[
                    { color: isCurrentMonth ? colors.text : colors.textMuted },
                    isDayToday && { color: colors.primary, fontWeight: 'bold' },
                    isSelected && { color: colors.primary },
                  ]}
                >
                  {format(day, 'd')}
                </Text>

                {/* Todo indicators */}
                {dayTodos.length > 0 && (
                  <View style={styles.todoIndicators}>
                    {dayTodos.slice(0, 3).map((todo) => (
                      <View
                        key={todo.id}
                        style={[
                          styles.todoIndicator,
                          { backgroundColor: getCategoryColor(todo.categoryId) },
                        ]}
                      />
                    ))}
                    {dayTodos.length > 3 && (
                      <Text category="c2" style={{ color: colors.textMuted, fontSize: 8 }}>
                        +{dayTodos.length - 3}
                      </Text>
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Selected Date Tasks */}
        {selectedDate && (
          <View style={[styles.selectedDateSection, { borderTopColor: colors.separator }]}>
            <Text category="s1" style={{ marginBottom: Spacing.sm }}>
              {format(selectedDate, 'EEEE, d MMMM', { locale })}
            </Text>

            <View>
              {selectedDateTodos.length === 0 ? (
                <EmptyState
                  icon="calendar-outline"
                  title={t('views.noTasksThisDay')}
                />
              ) : (
                selectedDateTodos.map((todo) => (
                  <Card
                    key={todo.id}
                    style={[styles.taskCard, { backgroundColor: colors.card }]}
                    onPress={() => handleTodoPress(todo.id)}
                  >
                    <View style={styles.taskContent}>
                      <View
                        style={[
                          styles.taskIndicator,
                          { backgroundColor: getCategoryColor(todo.categoryId) },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text category="s2" numberOfLines={1}>
                          {todo.title}
                        </Text>
                        <Text category="c1" style={{ color: colors.textMuted }}>
                          {t(STATUS_LABEL_KEYS[todo.status])}
                        </Text>
                      </View>
                      <Icon name="chevron-right-outline" fill={colors.textMuted} size={16} />
                    </View>
                  </Card>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  navButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  weekdaysRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.sm,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  otherMonthDay: {
    opacity: 0.3,
  },
  todoIndicators: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
    alignItems: 'center',
  },
  todoIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  selectedDateSection: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
    paddingTop: Spacing.md,
  },
  taskCard: {
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  taskContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  taskIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
  },
});
