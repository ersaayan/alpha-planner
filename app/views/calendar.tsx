import { Icon } from '@/components/icon';
import { Button, Card, Text } from '@ui-kitten/components';
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
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCategoryStore, useSettingsStore, useTodoStore } from '@/stores';
import type { Todo } from '@/types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const weekStartsOn = useSettingsStore((state) => state.settings.weekStartsOn);

  const [currentMonth, setCurrentMonth] = useState(new Date());
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

  // Get todos for a specific date
  const getTodosForDate = (date: Date): Todo[] => {
    return todos.filter((todo) => {
      if (!todo.dueDate) return false;
      return isSameDay(new Date(todo.dueDate), date);
    });
  };

  // Get todos for selected date
  const selectedDateTodos = selectedDate ? getTodosForDate(selectedDate) : [];

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
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
      {/* Header */}
      <View style={styles.header}>
        <Button
          appearance="ghost"
          size="small"
          accessoryLeft={(props) => <Icon {...props} name="arrow-back-outline" />}
          onPress={() => router.back()}
        />
        <Text category="h5">Calendar</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <Pressable onPress={handlePrevMonth} style={styles.navButton}>
          <Icon name="arrow-back-outline" fill={colors.text} size={20} />
        </Pressable>
        <Pressable
          onPress={() => {
            setCurrentMonth(new Date());
            setSelectedDate(new Date());
          }}
        >
          <Text category="h6">{format(currentMonth, 'MMMM yyyy')}</Text>
        </Pressable>
        <Pressable onPress={handleNextMonth} style={styles.navButton}>
          <Icon name="arrow-forward-outline" fill={colors.text} size={20} />
        </Pressable>
      </View>

      {/* Weekday Headers */}
      <View style={styles.weekdaysRow}>
        {(weekStartsOn === 1
          ? [...WEEKDAYS.slice(1), WEEKDAYS[0]]
          : WEEKDAYS
        ).map((day) => (
          <View key={day} style={styles.weekdayCell}>
            <Text category="c2" style={{ color: colors.textMuted }}>
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid} accessibilityLabel="Calendar days">
        {calendarDays.map((day, index) => {
          const dayTodos = getTodosForDate(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isDayToday = isSameDay(day, new Date());
          const taskCountLabel = dayTodos.length === 0
            ? 'no tasks'
            : dayTodos.length === 1
              ? '1 task'
              : `${dayTodos.length} tasks`;

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
              accessibilityLabel={`${format(day, 'EEEE, MMMM d')}, ${taskCountLabel}${isDayToday ? ', today' : ''}${isSelected ? ', selected' : ''}`}
              accessibilityState={{ selected: isSelected ?? false }}
              accessibilityHint="Double tap to view tasks for this day"
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
            {format(selectedDate, 'EEEE, MMMM d')}
          </Text>

          <ScrollView style={styles.tasksList} showsVerticalScrollIndicator={false}>
            {selectedDateTodos.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="calendar-outline" fill={colors.textMuted} size={32} />
                <Text category="c1" style={{ color: colors.textMuted, marginTop: Spacing.sm }}>
                  No tasks due on this day
                </Text>
              </View>
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
                        {todo.status === 'completed' ? 'Completed' : todo.status.replace('_', ' ')}
                      </Text>
                    </View>
                    <Icon name="chevron-right-outline" fill={colors.textMuted} size={16} />
                  </View>
                </Card>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  navButton: {
    padding: Spacing.sm,
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
    flex: 1,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
    paddingTop: Spacing.md,
  },
  tasksList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
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
