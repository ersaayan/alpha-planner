import { Icon } from '@/components/icon';
import { ScreenHeader } from '@/components/common/screen-header';
import { Card, Text } from '@ui-kitten/components';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { STATUSES, STATUS_LABEL_KEYS } from '@/constants/todo-options';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCategoryStore, useSettingsStore, useTodoStore } from '@/stores';
import type { Todo, TodoStatus } from '@/types';
import { formatDue } from '@/utils/todo-dates';

const COLUMNS: readonly TodoStatus[] = STATUSES;

export default function KanbanScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const columnColors: Record<TodoStatus, string> = {
    pending: colors.primaryLight,
    in_progress: colors.priorityMedium,
    completed: colors.primary,
    archived: colors.textMuted,
  };
  const { width: screenWidth } = useWindowDimensions();
  const columnWidth = screenWidth * 0.75;

  const todos = useTodoStore((state) => state.todos);
  const updateTodo = useTodoStore((state) => state.updateTodo);
  const categories = useCategoryStore((state) => state.categories);
  const dateFormat = useSettingsStore((state) => state.settings.dateFormat);
  const timeFormat = useSettingsStore((state) => state.settings.timeFormat);

  const getTodosByStatus = (status: TodoStatus): Todo[] => {
    return todos.filter((todo) => todo.status === status);
  };

  const getCategoryColor = (categoryId: string | null): string => {
    if (!categoryId) return colors.border;
    const category = categories.find((c) => c.id === categoryId);
    return category?.color ?? colors.border;
  };

  const handleTodoPress = (todoId: string) => {
    router.push(`/todo/${todoId}`);
  };

  const handleMoveLeft = (todo: Todo) => {
    const currentIndex = COLUMNS.indexOf(todo.status);
    if (currentIndex > 0) {
      updateTodo(todo.id, { status: COLUMNS[currentIndex - 1] });
    }
  };

  const handleMoveRight = (todo: Todo) => {
    const currentIndex = COLUMNS.indexOf(todo.status);
    if (currentIndex < COLUMNS.length - 1) {
      updateTodo(todo.id, { status: COLUMNS[currentIndex + 1] });
    }
  };

  const renderTodoCard = (todo: Todo) => {
    const currentIndex = COLUMNS.indexOf(todo.status);
    const canMoveLeft = currentIndex > 0;
    const canMoveRight = currentIndex < COLUMNS.length - 1;

    return (
      <Card
        key={todo.id}
        style={[styles.todoCard, { backgroundColor: colors.card }]}
        onPress={() => handleTodoPress(todo.id)}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.categoryIndicator,
              { backgroundColor: getCategoryColor(todo.categoryId) },
            ]}
          />
          <Text category="s2" numberOfLines={2} style={{ flex: 1 }}>
            {todo.title}
          </Text>
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
          {todo.subtasks.length > 0 && (
            <View style={styles.subtaskBadge}>
              <Icon name="checkmark-square-2-outline" fill={colors.textMuted} size={12} />
              <Text category="c2" style={{ color: colors.textMuted }}>
                {todo.subtasks.filter((s) => s.isCompleted).length}/{todo.subtasks.length}
              </Text>
            </View>
          )}

          {todo.dueDate && (
            <View style={styles.dueDateBadge}>
              <Icon name="calendar-outline" fill={colors.textMuted} size={12} />
              <Text category="c2" style={{ color: colors.textMuted }}>
                {formatDue(todo.dueDate, todo.dueTime, dateFormat, timeFormat, i18n.language)}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.moveButtons, { borderTopColor: colors.separator }]}>
          <Pressable
            style={[styles.moveButton, !canMoveLeft && styles.moveButtonDisabled]}
            onPress={() => canMoveLeft && handleMoveLeft(todo)}
            disabled={!canMoveLeft}
            accessibilityRole="button"
            accessibilityLabel={
              canMoveLeft
                ? t('views.moveTaskTo', { title: todo.title, column: t(STATUS_LABEL_KEYS[COLUMNS[currentIndex - 1]]) })
                : t('views.movePrevious')
            }
            accessibilityState={{ disabled: !canMoveLeft }}
          >
            <Icon
              name="arrow-back-outline"
              fill={canMoveLeft ? colors.primary : colors.border}
              size={20}
            />
          </Pressable>
          <Pressable
            style={[styles.moveButton, !canMoveRight && styles.moveButtonDisabled]}
            onPress={() => canMoveRight && handleMoveRight(todo)}
            disabled={!canMoveRight}
            accessibilityRole="button"
            accessibilityLabel={
              canMoveRight
                ? t('views.moveTaskTo', { title: todo.title, column: t(STATUS_LABEL_KEYS[COLUMNS[currentIndex + 1]]) })
                : t('views.moveNext')
            }
            accessibilityState={{ disabled: !canMoveRight }}
          >
            <Icon
              name="arrow-forward-outline"
              fill={canMoveRight ? colors.primary : colors.border}
              size={20}
            />
          </Pressable>
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
      <ScreenHeader title={t('views.kanbanBoard')} />

      {/* Kanban Columns */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.columnsContainer}
        decelerationRate="fast"
        snapToInterval={columnWidth + Spacing.md}
      >
        {COLUMNS.map((column) => {
          const columnTodos = getTodosByStatus(column);
          const columnColor = columnColors[column];
          return (
            <View
              key={column}
              style={[styles.column, { width: columnWidth }]}
            >
              {/* Column Header */}
              <View style={styles.columnHeader}>
                <View style={[styles.columnDot, { backgroundColor: columnColor }]} />
                <Text category="s1" accessibilityRole="header">
                  {t(STATUS_LABEL_KEYS[column])}
                </Text>
                <View style={[styles.countBadge, { backgroundColor: columnColor + '20' }]}>
                  <Text category="c2" style={{ color: colors.text }}>
                    {columnTodos.length}
                  </Text>
                </View>
              </View>

              {/* Column Content (virtualized: a column can hold many tasks) */}
              <FlatList
                style={styles.columnContent}
                data={columnTodos}
                keyExtractor={(todo) => todo.id}
                renderItem={({ item }) => renderTodoCard(item)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.columnScrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
                ListEmptyComponent={
                  <View style={styles.emptyColumn}>
                    <Icon name="inbox-outline" fill={colors.textMuted} size={32} />
                    <Text category="c1" style={{ color: colors.textMuted, marginTop: Spacing.sm }}>
                      {t('views.emptyColumn')}
                    </Text>
                  </View>
                }
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  columnsContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  column: {
    marginRight: Spacing.md,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  columnDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  columnContent: {
    flex: 1,
  },
  columnScrollContent: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  emptyColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    opacity: 0.6,
  },
  todoCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  categoryIndicator: {
    width: 4,
    height: '100%',
    minHeight: 20,
    borderRadius: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  subtaskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moveButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    borderTopWidth: 1,
  },
  moveButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  moveButtonDisabled: {
    opacity: 0.3,
  },
});
