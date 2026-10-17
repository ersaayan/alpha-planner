import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, View } from 'react-native';
import { Text, Card } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { ScreenHeader } from '@/components/common/screen-header';
import { EmptyState } from '@/components/common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { startOfDay } from 'date-fns';

import { useTodoStore, useCategoryStore, useSettingsStore } from '@/stores';
import type { Todo } from '@/types';
import { addDaysToKey, getDateKey, parseDateKey } from '@/utils/date';
import { formatTime, getDueDateKey, isPastDue } from '@/utils/todo-dates';
import { formatLocalized } from '@/utils/locale';
import { categoryName } from '@/services/gamification/display';

import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { priorityColor } from '@/constants/todo-options';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Only tasks still to do belong on the timeline (not completed or archived ones). */
function isOpen(todo: Todo): boolean {
  return todo.status === 'pending' || todo.status === 'in_progress';
}

interface TimelineSection {
  kind: 'day' | 'unscheduled';
  key: string;
  label: string;
  isOverdue: boolean;
  /** Another day follows (the rail continues). */
  hasNext: boolean;
  data: Todo[];
}

interface TimelineDay {
  key: string;
  date: Date;
  label: string;
  todos: Todo[];
  isOverdue: boolean;
}

export default function TimelineScreen() {
  const { t, i18n } = useTranslation();
  const timeFormat = useSettingsStore((state) => state.settings.timeFormat);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const todos = useTodoStore((state) => state.todos);
  const categories = useCategoryStore((state) => state.categories);

  // Track the current date so useMemo recomputes labels/overdue at midnight
  const [todayKey, setTodayKey] = useState(() => getDateKey());
  useEffect(() => {
    const now = new Date();
    const tomorrow = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    const timer = setTimeout(() => {
      setTodayKey(getDateKey());
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
    return category ? categoryName(t, category) : null;
  };

  // Organize open todos into timeline days (local due days)
  const timelineDays = useMemo(() => {
    const dateMap = new Map<string, Todo[]>();
    for (const todo of todos) {
      if (!isOpen(todo)) continue;
      const dateKey = getDueDateKey(todo.dueDate);
      if (!dateKey) continue;
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
      dateMap.get(dateKey)!.push(todo);
    }

    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const label = (key: string) =>
      key === todayKey
        ? t('common.today')
        : key === addDaysToKey(todayKey, 1)
          ? t('common.tomorrow')
          : key === addDaysToKey(todayKey, -1)
            ? t('common.yesterday')
            : formatLocalized(parseDateKey(key), 'EEEE, d MMMM', i18n.language);

    const days: TimelineDay[] = [...dateMap.entries()].map(([key, dayTodos]) => ({
      key,
      date: parseDateKey(key),
      label: label(key),
      todos: dayTodos.sort((a, b) => {
        // Timed tasks first by time, then priority, then title
        if ((a.dueTime ?? '99') !== (b.dueTime ?? '99')) return (a.dueTime ?? '99') < (b.dueTime ?? '99') ? -1 : 1;
        const aPriority = priorityOrder[a.priority] ?? 2;
        const bPriority = priorityOrder[b.priority] ?? 2;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.title.localeCompare(b.title, i18n.language);
      }),
      isOverdue: key < todayKey,
    }));

    return days.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }, [todos, todayKey, t, i18n.language]);

  // Todos without due date
  const unscheduledTodos = useMemo(() => {
    return todos.filter((todo) => !todo.dueDate && isOpen(todo));
  }, [todos]);

  const sections = useMemo<TimelineSection[]>(() => {
    const daySections: TimelineSection[] = timelineDays.map((day, index) => ({
      kind: 'day',
      key: day.key,
      label: day.label,
      isOverdue: day.isOverdue,
      hasNext: index < timelineDays.length - 1,
      data: day.todos,
    }));
    return unscheduledTodos.length > 0
      ? [...daySections, { kind: 'unscheduled', key: 'unscheduled', label: '', isOverdue: false, hasNext: false, data: unscheduledTodos }]
      : daySections;
  }, [timelineDays, unscheduledTodos]);

  const handleTodoPress = (todoId: string) => {
    router.push(`/todo/${todoId}`);
  };

  const renderTodoCard = (todo: Todo, dayIsOverdue: boolean) => {
    // A task due today at a time that has passed is late too.
    const isOverdue = dayIsOverdue || isPastDue(todo.dueDate, new Date(), todo.dueTime);
    return (
    <Card
      key={todo.id}
      style={[styles.todoCard, { backgroundColor: colors.card }]}
      onPress={() => handleTodoPress(todo.id)}
      accessibilityRole="button"
      accessibilityLabel={isOverdue ? `${todo.title}, ${t('views.overdue')}` : todo.title}
    >
      <View style={styles.cardContent}>
        <View
          style={[
            styles.priorityBar,
            { backgroundColor: priorityColor(todo.priority, colors) },
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
                  {t('views.overdue')}
                </Text>
              </View>
            )}
          </View>

          {todo.dueTime ? (
            <Text category="c2" style={{ color: isOverdue ? colors.priorityUrgent : colors.textMuted }}>
              {formatTime(todo.dueTime, timeFormat, i18n.language)}
            </Text>
          ) : null}

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
                  {getCategoryName(todo.categoryId) ?? ''}
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
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <ScreenHeader title={t('views.timeline')} />

      {/* Virtualized: days are sections, their open tasks the items, unscheduled tasks last. */}
      <SectionList
        style={styles.scrollView}
        sections={sections}
        keyExtractor={(todo) => todo.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState icon="calendar-outline" title={t('views.timelineEmpty')} subtitle={t('views.timelineEmptyHint')} />
        }
        renderSectionHeader={({ section }) =>
          section.kind === 'unscheduled' ? (
            <View style={[styles.unscheduledHeader, { borderTopColor: colors.separator }]}>
              <Icon name="inbox-outline" fill={colors.textMuted} size={20} />
              <Text category="s1" style={{ marginLeft: Spacing.sm }} accessibilityRole="header">
                {t('views.unscheduled')}
              </Text>
              <Text category="c2" style={{ color: colors.textMuted, marginLeft: Spacing.sm }}>
                {t('views.taskCount', { count: section.data.length })}
              </Text>
            </View>
          ) : (
            <View style={styles.timelineRow}>
              <View style={styles.timelineNodeContainer}>
                <View
                  style={[
                    styles.timelineNode,
                    {
                      backgroundColor: section.isOverdue
                        ? colors.priorityUrgent
                        : section.key === todayKey
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                />
                {section.hasNext && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
              </View>
              <View style={[styles.dayContent, styles.dayHeader]}>
                <Text
                  category="s1"
                  accessibilityRole="header"
                  style={[
                    section.isOverdue && { color: colors.priorityUrgent },
                    section.key === todayKey && { color: colors.primary },
                  ]}
                >
                  {section.label}
                </Text>
                <Text category="c2" style={{ color: colors.textMuted }}>
                  {t('views.taskCount', { count: section.data.length })}
                </Text>
              </View>
            </View>
          )
        }
        renderItem={({ item, section }) =>
          section.kind === 'unscheduled' ? (
            <View style={styles.unscheduledItem}>{renderTodoCard(item, false)}</View>
          ) : (
            <View style={styles.timelineRow}>
              {/* The rail continues past the day's tasks to the next day */}
              <View style={styles.timelineNodeContainer}>
                {section.hasNext && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
              </View>
              <View style={[styles.dayContent, styles.dayItem]}>{renderTodoCard(item, section.isOverdue)}</View>
            </View>
          )
        }
        renderSectionFooter={({ section }) =>
          section.kind === 'day' && section.hasNext ? (
            <View style={styles.timelineRow}>
              <View style={[styles.timelineNodeContainer, styles.dayGap]}>
                <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
              </View>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  timelineRow: {
    flexDirection: 'row',
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
  },
  dayContent: {
    flex: 1,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
  },
  dayItem: {
    paddingBottom: Spacing.sm,
  },
  dayGap: {
    height: Spacing.lg,
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
  unscheduledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
  },
  unscheduledItem: {
    paddingBottom: Spacing.sm,
  },
});
