import { useMemo, useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Card, Button } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  format,
  isToday,
  isTomorrow,
  startOfDay,
} from 'date-fns';

import { useTodoStore, useCategoryStore } from '@/stores';
import type { Todo } from '@/types';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface TimelineDay {
  date: Date;
  label: string;
  todos: Todo[];
  isOverdue: boolean;
}

export default function TimelineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const todos = useTodoStore((state) => state.todos);
  const categories = useCategoryStore((state) => state.categories);

  // Track the current date so useMemo recomputes labels/overdue at midnight
  const [todayKey, setTodayKey] = useState(() => startOfDay(new Date()).toISOString());
  useEffect(() => {
    const now = new Date();
    const tomorrow = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    const timer = setTimeout(() => {
      setTodayKey(startOfDay(new Date()).toISOString());
    }, msUntilMidnight);
    return () => clearTimeout(timer);
  }, [todayKey]);

  const getCategoryColor = (categoryId: string | null): string => {
    if (!categoryId) return colors.primary;
    const category = categories.find((c) => c.id === categoryId);
    return category?.color ?? colors.primary;
  };

  const getCategoryName = (categoryId: string | null): string | null => {
    if (!categoryId) return null;
    const category = categories.find((c) => c.id === categoryId);
    return category?.name ?? null;
  };

  // Get label for a date
  const getDateLabel = (date: Date): string => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMM d');
  };

  // Organize todos into timeline days
  const timelineDays = useMemo(() => {
    const todosWithDueDate = todos.filter(
      (todo) => todo.dueDate && todo.status !== 'completed'
    );

    // Group by date
    const dateMap = new Map<string, Todo[]>();

    todosWithDueDate.forEach((todo) => {
      const dateKey = startOfDay(new Date(todo.dueDate!)).toISOString();
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(todo);
    });

    // Convert to array and sort by date
    const days: TimelineDay[] = [];
    const today = new Date(todayKey);

    dateMap.forEach((dayTodos, dateKey) => {
      const date = new Date(dateKey);
      days.push({
        date,
        label: getDateLabel(date),
        todos: dayTodos.sort((a, b) => {
          // Sort by priority then by title
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          const aPriority = priorityOrder[a.priority] ?? 2;
          const bPriority = priorityOrder[b.priority] ?? 2;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return a.title.localeCompare(b.title);
        }),
        isOverdue: date < today,
      });
    });

    // Sort days by date
    days.sort((a, b) => a.date.getTime() - b.date.getTime());

    return days;
  }, [todos, todayKey]);

  // Todos without due date
  const unscheduledTodos = useMemo(() => {
    return todos.filter(
      (todo) => !todo.dueDate && todo.status !== 'completed'
    );
  }, [todos]);

  const handleTodoPress = (todoId: string) => {
    router.push(`/todo/${todoId}`);
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'urgent': return colors.priorityUrgent;
      case 'high': return colors.priorityHigh;
      case 'medium': return colors.priorityMedium;
      case 'low': return colors.priorityLow;
      default: return colors.textMuted;
    }
  };

  const renderTodoCard = (todo: Todo, isOverdue: boolean) => (
    <Card
      key={todo.id}
      style={[styles.todoCard, { backgroundColor: colors.card }]}
      onPress={() => handleTodoPress(todo.id)}
      accessibilityRole="button"
      accessibilityLabel={`${todo.title}${isOverdue ? ', overdue' : ''}${todo.priority !== 'low' ? `, ${todo.priority} priority` : ''}`}
      accessibilityHint="Double tap to view task details"
    >
      <View style={styles.cardContent}>
        <View
          style={[
            styles.priorityBar,
            { backgroundColor: getPriorityColor(todo.priority) },
          ]}
        />
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text
              category="s2"
              numberOfLines={2}
              style={[
                { flex: 1 },
                isOverdue && { color: colors.priorityUrgent },
              ]}
            >
              {todo.title}
            </Text>
            {isOverdue && (
              <View style={styles.overdueBadge}>
                <Icon name="alert-circle-outline" fill={colors.priorityUrgent} size={12} />
                <Text category="c2" style={{ color: colors.priorityUrgent, marginLeft: 2 }}>
                  Overdue
                </Text>
              </View>
            )}
          </View>

          {todo.description && (
            <Text
              category="c1"
              numberOfLines={2}
              style={{ color: colors.textSecondary, marginTop: Spacing.xs }}
            >
              {todo.description}
            </Text>
          )}

          <View style={styles.cardFooter}>
            {getCategoryName(todo.categoryId) && (
              <View style={styles.categoryBadge}>
                <View
                  style={[
                    styles.categoryDot,
                    { backgroundColor: getCategoryColor(todo.categoryId) },
                  ]}
                />
                <Text category="c2" style={{ color: colors.textMuted }}>
                  {getCategoryName(todo.categoryId)}
                </Text>
              </View>
            )}

            {todo.subtasks.length > 0 && (
              <View style={styles.subtaskBadge}>
                <Icon name="checkmark-square-2-outline" fill={colors.textMuted} size={12} />
                <Text category="c2" style={{ color: colors.textMuted }}>
                  {todo.subtasks.filter((s) => s.isCompleted).length}/{todo.subtasks.length}
                </Text>
              </View>
            )}

            {todo.estimatedPomodoros && (
              <View style={styles.pomodoroBadge}>
                <Icon name="clock-outline" fill={colors.textMuted} size={12} />
                <Text category="c2" style={{ color: colors.textMuted }}>
                  {todo.pomodoroSessions}/{todo.estimatedPomodoros}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Icon name="chevron-right-outline" fill={colors.textMuted} size={16} />
      </View>
    </Card>
  );

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
        <Text category="h5">Timeline</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Empty State */}
        {timelineDays.length === 0 && unscheduledTodos.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="calendar-outline" fill={colors.textMuted} size={48} />
            <Text category="s1" style={{ color: colors.textMuted, marginTop: Spacing.md }}>
              No upcoming tasks
            </Text>
            <Text category="c1" style={{ color: colors.textMuted, marginTop: Spacing.xs }}>
              Create a task with a due date to see it here
            </Text>
          </View>
        )}

        {/* Timeline Days */}
        {timelineDays.map((day, dayIndex) => (
          <View key={day.date.toISOString()} style={styles.timelineDay}>
            {/* Timeline Node */}
            <View style={styles.timelineNodeContainer}>
              <View
                style={[
                  styles.timelineNode,
                  {
                    backgroundColor: day.isOverdue
                      ? colors.priorityUrgent
                      : isToday(day.date)
                        ? colors.primary
                        : colors.border,
                  },
                ]}
              />
              {dayIndex < timelineDays.length - 1 && (
                <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
              )}
            </View>

            {/* Day Content */}
            <View style={styles.dayContent}>
              <View style={styles.dayHeader}>
                <Text
                  category="s1"
                  style={[
                    day.isOverdue && { color: colors.priorityUrgent },
                    isToday(day.date) && { color: colors.primary },
                  ]}
                >
                  {day.label}
                </Text>
                <Text category="c2" style={{ color: colors.textMuted }}>
                  {day.todos.length} task{day.todos.length !== 1 ? 's' : ''}
                </Text>
              </View>

              <View style={styles.dayTodos}>
                {day.todos.map((todo) => renderTodoCard(todo, day.isOverdue))}
              </View>
            </View>
          </View>
        ))}

        {/* Unscheduled Section */}
        {unscheduledTodos.length > 0 && (
          <View style={[styles.unscheduledSection, { borderTopColor: colors.separator }]}>
            <View style={styles.unscheduledHeader}>
              <Icon name="inbox-outline" fill={colors.textMuted} size={20} />
              <Text category="s1" style={{ marginLeft: Spacing.sm }}>
                Unscheduled
              </Text>
              <Text category="c2" style={{ color: colors.textMuted, marginLeft: Spacing.sm }}>
                {unscheduledTodos.length} task{unscheduledTodos.length !== 1 ? 's' : ''}
              </Text>
            </View>

            <View style={styles.unscheduledTodos}>
              {unscheduledTodos.map((todo) => renderTodoCard(todo, false))}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  timelineDay: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  timelineNodeContainer: {
    alignItems: 'center',
    width: 24,
    marginRight: Spacing.md,
  },
  timelineNode: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: Spacing.xs,
  },
  dayContent: {
    flex: 1,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  dayTodos: {
    gap: Spacing.sm,
  },
  todoCard: {
    borderRadius: BorderRadius.md,
    padding: 0,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardBody: {
    flex: 1,
    padding: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subtaskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pomodoroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unscheduledSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  unscheduledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  unscheduledTodos: {
    gap: Spacing.sm,
  },
});
