import { Icon } from '@/components/icon';
import { Text } from '@ui-kitten/components';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  Layout
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, Colors, FontSize, InterFonts, Shadows, Spacing } from '@/constants/theme';
import { PRIORITY_LABEL_KEYS, priorityColor } from '@/constants/todo-options';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useCategoryStore, useSettingsStore, useTodoStore } from '@/stores';
import type { Todo, TodoStatus } from '@/types';
import { formatDue, isPastDue } from '@/utils/todo-dates';
import { filterTodos, sortTodos } from '@/utils/todo-list';
import { categoryName } from '@/services/gamification/display';
import { TodoFilterSheet } from '@/components/todos/todo-filter-sheet';

import { AnimatedButton } from '@/components/animated/animated-button';
import { AnimatedCard } from '@/components/animated/animated-card';
import { AnimatedCheckbox } from '@/components/animated/animated-checkbox';
import { EmptyState } from '@/components/common';

const STATUS_TABS: { labelKey: string; value: TodoStatus | 'all' }[] = [
  { labelKey: 'todos.statusAll', value: 'all' },
  { labelKey: 'todos.statusPending', value: 'pending' },
  { labelKey: 'todos.statusInProgress', value: 'in_progress' },
  { labelKey: 'todos.statusDone', value: 'completed' },
];

const EMPTY_STATUS_KEYS: Partial<Record<TodoStatus, string>> = {
  pending: 'todos.emptyPending',
  in_progress: 'todos.emptyInProgress',
  completed: 'todos.emptyCompleted',
};

export default function TodosScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [activeTab, setActiveTab] = useState<TodoStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);

  const todos = useTodoStore((state) => state.todos);
  const toggleTodoStatus = useTodoStore((state) => state.toggleTodoStatus);
  const categories = useCategoryStore((state) => state.categories);
  const getCategoryColor = useCategoryStore((state) => state.getCategoryColor);
  const dateFormat = useSettingsStore((state) => state.settings.dateFormat);
  const timeFormat = useSettingsStore((state) => state.settings.timeFormat);
  const filter = useTodoStore((state) => state.filter);
  const sortBy = useTodoStore((state) => state.sortBy);
  const clearFilter = useTodoStore((state) => state.clearFilter);
  const setSortBy = useTodoStore((state) => state.setSortBy);

  const filtersActive = Boolean(filter.categoryId) || (filter.priority?.length ?? 0) > 0 || sortBy !== 'manual';

  const filteredTodos = useMemo(
    () =>
      sortTodos(
        filterTodos(todos, {
          status: activeTab,
          search: searchQuery,
          categoryId: filter.categoryId,
          priorities: filter.priority,
        }),
        sortBy
      ),
    [todos, activeTab, searchQuery, filter.categoryId, filter.priority, sortBy]
  );

  const getCategoryName = useCallback((categoryId: string | null) => {
    if (!categoryId) return null;
    return categoryName(t, categories.find((c) => c.id === categoryId));
  }, [categories, t]);

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
        accentColor={priorityColor(item.priority, colors)}
        accentPosition="left"
      >
        <View style={styles.todoItem}>
          {/* Checkbox: its own control, next to (not inside) the row that opens the task */}
          <AnimatedCheckbox
            checked={item.status === 'completed'}
            onToggle={() => toggleTodoStatus(item.id)}
            size={22}
            color={colors.primary}
            accessibilityLabel={item.title}
            accessibilityHint={t(item.status === 'completed' ? 'todo.form.markIncompleteHint' : 'todo.form.markCompleteHint')}
          />

          {/* Content: opens the task */}
          <Pressable
            style={({ pressed }) => [styles.todoContent, pressed && styles.pressed]}
            onPress={() => handleTodoPress(item.id)}
            accessibilityRole="button"
            accessibilityHint={t('todos.openTaskHint')}
          >
            <View style={styles.todoText}>
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
                    <Text style={[styles.categoryText, { color: colors.text }]}>
                      {getCategoryName(item.categoryId) ?? ''}
                    </Text>
                  </View>
                )}

                {/* Due date */}
                {item.dueDate && (
                  <View style={styles.dueDateContainer}>
                    <Icon name={item.dueTime ? 'clock' : 'calendar'} fill={colors.textMuted} style={styles.metaIcon} />
                    <Text
                      style={[
                        styles.dueDateText,
                        {
                          color:
                            (item.status === 'pending' || item.status === 'in_progress') && isPastDue(item.dueDate, new Date(), item.dueTime)
                              ? colors.error
                              : colors.textMuted,
                        },
                      ]}
                    >
                      {formatDue(item.dueDate, item.dueTime, dateFormat, timeFormat, i18n.language)}
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
          </Pressable>
        </View>
      </AnimatedCard>
    </Animated.View>
  ), [colors, toggleTodoStatus, getCategoryColor, getCategoryName, handleTodoPress, dateFormat, timeFormat, i18n.language, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('todos.title')}</Text>
        <View style={styles.headerActions}>
          {/* View Toggle Buttons */}
          <View style={styles.viewToggle}>
            <Pressable
              style={[styles.viewButton, { backgroundColor: colors.card }]}
              hitSlop={6}
              onPress={() => router.push('/views/kanban')}
              accessibilityRole="button"
              accessibilityLabel={t('todos.kanbanView')}
            >
              <Icon name="grid" fill={colors.primary} style={styles.viewIcon} />
            </Pressable>
            <Pressable
              style={[styles.viewButton, { backgroundColor: colors.card }]}
              hitSlop={6}
              onPress={() => router.push('/views/calendar')}
              accessibilityRole="button"
              accessibilityLabel={t('todos.calendarView')}
            >
              <Icon name="calendar" fill={colors.primary} style={styles.viewIcon} />
            </Pressable>
            <Pressable
              style={[styles.viewButton, { backgroundColor: colors.card }]}
              hitSlop={6}
              onPress={() => router.push('/views/timeline')}
              accessibilityRole="button"
              accessibilityLabel={t('todos.timelineView')}
            >
              <Icon name="activity" fill={colors.primary} style={styles.viewIcon} />
            </Pressable>
          </View>
          <AnimatedButton
            title={t('todos.add')}
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
          placeholder={t('todos.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel={t('common.search')}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('todos.clearSearch')}>
            <Icon name="close-circle" fill={colors.textMuted} style={styles.clearIcon} />
          </Pressable>
        )}
        <Pressable
          onPress={() => setFilterVisible(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('todos.filterTitle')}
          testID="todo-filter-button"
        >
          <Icon name="filter" fill={filtersActive ? colors.primary : colors.textMuted} style={styles.clearIcon} />
        </Pressable>
      </View>

      {filtersActive && (
        <View style={styles.activeFilters}>
          <Text style={[styles.activeFiltersText, { color: colors.textSecondary }]} numberOfLines={1}>
            {[
              filter.categoryId ? getCategoryName(filter.categoryId) : null,
              ...(filter.priority ?? []).map((p) => t(PRIORITY_LABEL_KEYS[p])),
              sortBy !== 'manual' ? t(`todos.sort.${sortBy}`) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Pressable
            onPress={() => {
              clearFilter();
              setSortBy('manual');
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('todos.clearFilters')}
          >
            <Text style={[styles.activeFiltersText, { color: colors.primary }]}>{t('todos.clearFilters')}</Text>
          </Pressable>
        </View>
      )}
      <TodoFilterSheet visible={filterVisible} onClose={() => setFilterVisible(false)} />

      {/* Status Tabs - Pill style */}
      <View style={styles.tabsContainer}>
        <View style={[styles.tabsBackground, { backgroundColor: colors.backgroundSecondary }]} accessibilityRole="tablist">
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
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: isActive ? colors.primary : colors.textMuted },
                  ]}
                >
                  {t(tab.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Todo List */}
      {filteredTodos.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title={t('todos.emptyTitle')}
          subtitle={
            searchQuery || filtersActive
              ? t('todos.emptySearch')
              : activeTab !== 'all'
                ? t(EMPTY_STATUS_KEYS[activeTab] ?? 'todos.emptyPending')
                : t('todos.emptyDefault')
          }
          action={
            !searchQuery && !filtersActive && activeTab === 'all' ? (
              <AnimatedButton
                title={t('todos.createTask')}
                icon="plus"
                variant="outline"
                size="sm"
                onPress={() => router.push('/todo/create')}
              />
            ) : undefined
          }
        />
      ) : (
        <FlatList
          data={filteredTodos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset }]}
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
  activeFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  activeFiltersText: {
    flexShrink: 1,
    fontFamily: InterFonts.medium,
    fontSize: FontSize.xs,
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
    minHeight: 40,
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },
  todoText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
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
});
