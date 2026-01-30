import { useState, useMemo } from 'react';
import { StyleSheet, View, FlatList, Pressable } from 'react-native';
import { Text, Button, Input, Card } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTodoStore, useCategoryStore, useSettingsStore } from '@/stores';
import type { TodoStatus } from '@/types';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDate } from '@/utils/date';

const STATUS_TABS: { label: string; value: TodoStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Archived', value: 'archived' },
];

export default function TodosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [activeTab, setActiveTab] = useState<TodoStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const todos = useTodoStore((state) => state.todos);
  const toggleTodoStatus = useTodoStore((state) => state.toggleTodoStatus);
  const categories = useCategoryStore((state) => state.categories);
  const getCategoryColor = useCategoryStore((state) => state.getCategoryColor);
  const dateFormat = useSettingsStore((state) => state.settings.dateFormat);

  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      if (activeTab !== 'all' && todo.status !== activeTab) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          todo.title.toLowerCase().includes(query) ||
          todo.description?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [todos, activeTab, searchQuery]);

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId)?.name;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return colors.priorityUrgent;
      case 'high':
        return colors.priorityHigh;
      case 'medium':
        return colors.priorityMedium;
      default:
        return colors.priorityLow;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text category="h5">My Tasks</Text>
        <View style={styles.headerActions}>
          {/* View Toggle Buttons */}
          <View style={styles.viewToggle} accessibilityRole="tablist">
            <Pressable
              style={[styles.viewButton, { backgroundColor: colors.card }]}
              onPress={() => router.push('/views/kanban')}
              accessibilityRole="button"
              accessibilityLabel="Kanban board view"
              accessibilityHint="Opens tasks in a kanban board layout"
            >
              <Icon name="grid-outline" fill={colors.primary} size={18} />
            </Pressable>
            <Pressable
              style={[styles.viewButton, { backgroundColor: colors.card }]}
              onPress={() => router.push('/views/calendar')}
              accessibilityRole="button"
              accessibilityLabel="Calendar view"
              accessibilityHint="Opens tasks in a calendar layout"
            >
              <Icon name="calendar-outline" fill={colors.primary} size={18} />
            </Pressable>
            <Pressable
              style={[styles.viewButton, { backgroundColor: colors.card }]}
              onPress={() => router.push('/views/timeline')}
              accessibilityRole="button"
              accessibilityLabel="Timeline view"
              accessibilityHint="Opens tasks in a timeline layout"
            >
              <Icon name="activity-outline" fill={colors.primary} size={18} />
            </Pressable>
          </View>
          <Button
            size="small"
            accessoryLeft={(props) => <Icon {...props} name="plus-outline" />}
            onPress={() => router.push('/todo/create')}
          >
            Add
          </Button>
        </View>
      </View>

      {/* Search */}
      <Input
        style={styles.searchInput}
        placeholder="Search tasks..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        accessoryLeft={(props) => <Icon {...props} name="search-outline" />}
        accessoryRight={
          searchQuery
            ? (props) => (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Icon {...props} name="close-outline" />
                </Pressable>
              )
            : undefined
        }
      />

      {/* Status Tabs */}
      <View style={styles.tabs}>
        {STATUS_TABS.map((tab) => (
          <Pressable
            key={tab.value}
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === tab.value
                  ? colors.primary
                  : colors.backgroundSecondary,
              },
            ]}
            onPress={() => setActiveTab(tab.value)}
          >
            <Text
              category="c1"
              style={{
                color: activeTab === tab.value ? '#fff' : colors.text,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Todo List */}
      {filteredTodos.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="clipboard-outline" fill={colors.textMuted} style={styles.emptyIcon} />
          <Text category="s1" style={{ color: colors.textMuted }}>
            No tasks found
          </Text>
          <Button
            size="small"
            appearance="ghost"
            style={{ marginTop: Spacing.md }}
            onPress={() => router.push('/todo/create')}
          >
            Create your first task
          </Button>
        </View>
      ) : (
        <FlatList
          data={filteredTodos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card
              style={[styles.todoCard, { backgroundColor: colors.card }]}
              onPress={() => router.push(`/todo/${item.id}`)}
            >
              <View style={styles.todoItem}>
                {/* Checkbox */}
                <Pressable
                  style={[
                    styles.checkbox,
                    {
                      borderColor: item.status === 'completed' ? colors.primary : colors.border,
                      backgroundColor: item.status === 'completed' ? colors.primary : 'transparent',
                    },
                  ]}
                  onPress={() => toggleTodoStatus(item.id)}
                >
                  {item.status === 'completed' && (
                    <Icon name="checkmark-outline" fill="#fff" style={styles.checkIcon} />
                  )}
                </Pressable>

                {/* Content */}
                <View style={styles.todoContent}>
                  <Text
                    category="s1"
                    style={[
                      item.status === 'completed' && styles.completedText,
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>

                  <View style={styles.todoMeta}>
                    {/* Priority indicator */}
                    <View
                      style={[
                        styles.priorityDot,
                        { backgroundColor: getPriorityColor(item.priority) },
                      ]}
                    />

                    {/* Category */}
                    {item.categoryId && (
                      <View
                        style={[
                          styles.categoryBadge,
                          { backgroundColor: getCategoryColor(item.categoryId) + '20' },
                        ]}
                      >
                        <Text
                          category="c2"
                          style={{ color: getCategoryColor(item.categoryId) }}
                        >
                          {getCategoryName(item.categoryId)}
                        </Text>
                      </View>
                    )}

                    {/* Due date */}
                    {item.dueDate && (
                      <Text category="c1" style={{ color: colors.textMuted }}>
                        {formatDate(new Date(item.dueDate), dateFormat)}
                      </Text>
                    )}

                    {/* Subtask count */}
                    {item.subtasks.length > 0 && (
                      <View style={styles.subtaskBadge}>
                        <Icon
                          name="layers-outline"
                          fill={colors.textMuted}
                          style={styles.subtaskIcon}
                        />
                        <Text category="c1" style={{ color: colors.textMuted }}>
                          {item.subtasks.filter((s) => s.isCompleted).length}/{item.subtasks.length}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <Icon name="chevron-right-outline" fill={colors.textMuted} style={styles.chevron} />
              </View>
            </Card>
          )}
        />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  viewButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  searchInput: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  tab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 100,
  },
  todoCard: {
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    marginRight: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    width: 16,
    height: 16,
  },
  todoContent: {
    flex: 1,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  todoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  subtaskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  subtaskIcon: {
    width: 12,
    height: 12,
  },
  chevron: {
    width: 20,
    height: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    marginBottom: Spacing.md,
  },
});
