import { Icon } from '@/components/icon';
import { Text } from '@ui-kitten/components';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  Layout
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, Colors, FontSize, InterFonts, Shadows, Spacing } from '@/constants/theme';
import { TAB_BAR_BOTTOM_PADDING } from '@/constants/defaults';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCategoryStore, useSettingsStore, useTodoStore } from '@/stores';
import type { Todo, TodoStatus } from '@/types';
import { formatDate } from '@/utils/date';

import { AnimatedButton } from '@/components/animated/animated-button';
import { AnimatedCard } from '@/components/animated/animated-card';
import { AnimatedCheckbox } from '@/components/animated/animated-checkbox';

const STATUS_TABS: { label: string; value: TodoStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'completed' },
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
    }).sort((a, b) => a.order - b.order);
  }, [todos, activeTab, searchQuery]);

  const getCategoryName = useCallback((categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId)?.name;
  }, [categories]);

  const getPriorityColor = useCallback((priority: string) => {
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
  }, [colors]);

  const handleTodoPress = useCallback((todoId: string) => {
    router.push(`/todo/${todoId}`);
  }, [router]);

  const renderTodoItem = useCallback(({ item }: { item: Todo }) => (
    <Animated.View
      entering={FadeIn.duration(200)}
      layout={Layout.springify()}
    >
      <AnimatedCard
        variant="default"
        style={styles.todoCard}
        contentStyle={styles.todoCardContent}
        accentColor={getPriorityColor(item.priority)}
        accentPosition="left"
        onPress={() => handleTodoPress(item.id)}
      >
        <View style={styles.todoItem}>
          {/* Checkbox */}
          <AnimatedCheckbox
            checked={item.status === 'completed'}
            onToggle={() => toggleTodoStatus(item.id)}
            size={22}
            color={colors.primary}
          />

          {/* Content */}
          <View style={styles.todoContent}>
            <Text
              style={[
                styles.todoTitle,
                { color: colors.text },
                item.status === 'completed' && styles.completedText,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>

            <View style={styles.todoMeta}>
              {/* Category chip */}
              {item.categoryId && (
                <View
                  style={[
                    styles.categoryChip,
                    { backgroundColor: getCategoryColor(item.categoryId) + '20' },
                  ]}
                >
                  <View
                    style={[
                      styles.categoryDot,
                      { backgroundColor: getCategoryColor(item.categoryId) },
                    ]}
                  />
                  <Text style={[styles.categoryText, { color: getCategoryColor(item.categoryId) }]}>
                    {getCategoryName(item.categoryId)}
                  </Text>
                </View>
              )}

              {/* Due date */}
              {item.dueDate && (
                <View style={styles.dueDateContainer}>
                  <Icon name="calendar" fill={colors.textMuted} style={styles.metaIcon} />
                  <Text style={[styles.dueDateText, { color: colors.textMuted }]}>
                    {formatDate(new Date(item.dueDate), dateFormat)}
                  </Text>
                </View>
              )}

              {/* Subtask count */}
              {item.subtasks.length > 0 && (
                <View style={styles.subtaskContainer}>
                  <Icon name="layers" fill={colors.textMuted} style={styles.metaIcon} />
                  <Text style={[styles.subtaskText, { color: colors.textMuted }]}>
                    {item.subtasks.filter((s) => s.isCompleted).length}/{item.subtasks.length}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Icon name="chevron-right" fill={colors.textMuted} style={styles.chevron} />
        </View>
      </AnimatedCard>
    </Animated.View>
  ), [colors, toggleTodoStatus, getCategoryColor, getCategoryName, getPriorityColor, handleTodoPress, dateFormat]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Tasks</Text>
        <View style={styles.headerActions}>
          {/* View Toggle Buttons */}
          <View style={styles.viewToggle}>
            <Pressable
              style={[styles.viewButton, { backgroundColor: colors.card }]}
              onPress={() => router.push('/views/kanban')}
              accessibilityRole="button"
              accessibilityLabel="Kanban view"
            >
              <Icon name="grid" fill={colors.primary} style={styles.viewIcon} />
            </Pressable>
            <Pressable
              style={[styles.viewButton, { backgroundColor: colors.card }]}
              onPress={() => router.push('/views/calendar')}
              accessibilityRole="button"
              accessibilityLabel="Calendar view"
            >
              <Icon name="calendar" fill={colors.primary} style={styles.viewIcon} />
            </Pressable>
            <Pressable
              style={[styles.viewButton, { backgroundColor: colors.card }]}
              onPress={() => router.push('/views/timeline')}
              accessibilityRole="button"
              accessibilityLabel="Timeline view"
            >
              <Icon name="activity" fill={colors.primary} style={styles.viewIcon} />
            </Pressable>
          </View>
          <AnimatedButton
            title="Add"
            icon="plus"
            variant="primary"
            size="sm"
            onPress={() => router.push('/todo/create')}
          />
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <Icon name="search" fill={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search tasks..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" fill={colors.textMuted} style={styles.clearIcon} />
          </Pressable>
        )}
      </View>

      {/* Status Tabs - Pill style */}
      <View style={styles.tabsContainer}>
        <View style={[styles.tabsBackground, { backgroundColor: colors.backgroundSecondary }]}>
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <Pressable
                key={tab.value}
                style={[
                  styles.tab,
                  isActive && [styles.activeTab, { backgroundColor: colors.card }],
                ]}
                onPress={() => setActiveTab(tab.value)}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: isActive ? colors.primary : colors.textMuted },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Todo List */}
      {filteredTodos.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Icon name="clipboard" fill={colors.primary} style={styles.emptyIcon} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No tasks found
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {searchQuery
              ? 'Try a different search term'
              : activeTab !== 'all'
                ? `No ${activeTab.replace('_', ' ')} tasks`
                : 'Create your first task to get started'
            }
          </Text>
          {!searchQuery && activeTab === 'all' && (
            <AnimatedButton
              title="Create Task"
              icon="plus"
              variant="outline"
              size="sm"
              onPress={() => router.push('/todo/create')}
              style={styles.emptyButton}
            />
          )}
        </View>
      ) : (
        <FlatList
          data={filteredTodos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderTodoItem}
          showsVerticalScrollIndicator={false}
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
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.xxl,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  viewButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  viewIcon: {
    width: 18,
    height: 18,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: InterFonts.regular,
    fontSize: FontSize.md,
    paddingVertical: Spacing.xs,
  },
  clearIcon: {
    width: 20,
    height: 20,
  },
  tabsContainer: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  tabsBackground: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: BorderRadius.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  activeTab: {
    ...Shadows.sm,
  },
  tabText: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: TAB_BAR_BOTTOM_PADDING,
  },
  todoCard: {
    marginBottom: Spacing.sm,
  },
  todoCardContent: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingLeft: Spacing.lg,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todoContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  todoTitle: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.md,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  todoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  categoryText: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.xs,
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueDateText: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
  },
  metaIcon: {
    width: 12,
    height: 12,
    marginRight: 3,
  },
  subtaskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtaskText: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
  },
  chevron: {
    width: 20,
    height: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: TAB_BAR_BOTTOM_PADDING,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyIcon: {
    width: 40,
    height: 40,
  },
  emptyTitle: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.lg,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: Spacing.lg,
  },
});
