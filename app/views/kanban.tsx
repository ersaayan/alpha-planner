import { useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Dimensions } from 'react-native';
import { Text, Card, Button } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTodoStore, useCategoryStore, useSettingsStore } from '@/stores';
import type { Todo, TodoStatus } from '@/types';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDate } from '@/utils/date';

const COLUMNS: { status: TodoStatus; title: string; color: string }[] = [
  { status: 'pending', title: 'To Do', color: '#90AB8B' },
  { status: 'in_progress', title: 'In Progress', color: '#B5A45E' },
  { status: 'completed', title: 'Done', color: '#5A7868' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = SCREEN_WIDTH * 0.75;

export default function KanbanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const todos = useTodoStore((state) => state.todos);
  const updateTodo = useTodoStore((state) => state.updateTodo);
  const categories = useCategoryStore((state) => state.categories);
  const dateFormat = useSettingsStore((state) => state.settings.dateFormat);

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
    const currentIndex = COLUMNS.findIndex((c) => c.status === todo.status);
    if (currentIndex > 0) {
      updateTodo(todo.id, { status: COLUMNS[currentIndex - 1].status });
    }
  };

  const handleMoveRight = (todo: Todo) => {
    const currentIndex = COLUMNS.findIndex((c) => c.status === todo.status);
    if (currentIndex < COLUMNS.length - 1) {
      updateTodo(todo.id, { status: COLUMNS[currentIndex + 1].status });
    }
  };

  const renderTodoCard = (todo: Todo) => {
    const currentIndex = COLUMNS.findIndex((c) => c.status === todo.status);
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
                {formatDate(new Date(todo.dueDate), dateFormat)}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.moveButtons, { borderTopColor: colors.separator }]}>
          <Pressable
            style={[styles.moveButton, !canMoveLeft && styles.moveButtonDisabled]}
            onPress={() => canMoveLeft && handleMoveLeft(todo)}
            disabled={!canMoveLeft}
          >
            <Icon
              name="arrow-back-outline"
              fill={canMoveLeft ? colors.primary : colors.border}
              size={16}
            />
          </Pressable>
          <Pressable
            style={[styles.moveButton, !canMoveRight && styles.moveButtonDisabled]}
            onPress={() => canMoveRight && handleMoveRight(todo)}
            disabled={!canMoveRight}
          >
            <Icon
              name="arrow-forward-outline"
              fill={canMoveRight ? colors.primary : colors.border}
              size={16}
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
      {/* Header */}
      <View style={styles.header}>
        <Button
          appearance="ghost"
          size="small"
          accessoryLeft={(props) => <Icon {...props} name="arrow-back-outline" />}
          onPress={() => router.back()}
        />
        <Text category="h5">Kanban Board</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Kanban Columns */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.columnsContainer}
        decelerationRate="fast"
        snapToInterval={COLUMN_WIDTH + Spacing.md}
      >
        {COLUMNS.map((column) => {
          const columnTodos = getTodosByStatus(column.status);
          return (
            <View
              key={column.status}
              style={[styles.column, { width: COLUMN_WIDTH }]}
            >
              {/* Column Header */}
              <View style={styles.columnHeader}>
                <View style={[styles.columnDot, { backgroundColor: column.color }]} />
                <Text category="s1">{column.title}</Text>
                <View style={[styles.countBadge, { backgroundColor: column.color + '20' }]}>
                  <Text category="c2" style={{ color: column.color }}>
                    {columnTodos.length}
                  </Text>
                </View>
              </View>

              {/* Column Content */}
              <ScrollView
                style={styles.columnContent}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.columnScrollContent}
              >
                {columnTodos.length === 0 ? (
                  <View style={styles.emptyColumn}>
                    <Icon name="inbox-outline" fill={colors.textMuted} size={32} />
                    <Text category="c1" style={{ color: colors.textMuted, marginTop: Spacing.sm }}>
                      No tasks
                    </Text>
                  </View>
                ) : (
                  columnTodos.map(renderTodoCard)
                )}
              </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
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
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  moveButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  moveButtonDisabled: {
    opacity: 0.3,
  },
});
