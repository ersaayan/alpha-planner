import { Text } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AnimatedButton } from '@/components/animated/animated-button';
import { Chip } from '@/components/common/chip';
import { SheetModal } from '@/components/common/sheet-modal';
import { Colors, FontSize, InterFonts, Spacing } from '@/constants/theme';
import { PRIORITIES, PRIORITY_LABEL_KEYS, priorityColor } from '@/constants/todo-options';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { categoryName } from '@/services/gamification/display';
import { useCategoryStore, useTodoStore } from '@/stores';
import type { TodoPriority } from '@/types';
import { TODO_SORTS } from '@/utils/todo-list';

// Most urgent first.
const PRIORITY_CHIPS = [...PRIORITIES].reverse();

/** Category, priority and sort options for the task list (kept between visits). */
export function TodoFilterSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const categories = useCategoryStore((state) => state.categories);
  const filter = useTodoStore((state) => state.filter);
  const sortBy = useTodoStore((state) => state.sortBy);
  const setFilter = useTodoStore((state) => state.setFilter);
  const clearFilter = useTodoStore((state) => state.clearFilter);
  const setSortBy = useTodoStore((state) => state.setSortBy);

  const priorities = filter.priority ?? [];
  const togglePriority = (priority: TodoPriority) =>
    setFilter({
      priority: priorities.includes(priority) ? priorities.filter((p) => p !== priority) : [...priorities, priority],
    });

  const section = (title: string) => (
    <Text style={[styles.section, { color: colors.textSecondary }]} accessibilityRole="header">
      {title}
    </Text>
  );

  return (
    <SheetModal
      visible={visible}
      title={t('todos.filterTitle')}
      icon="filter"
      onClose={onClose}
      footer={
        <>
          <AnimatedButton
            title={t('todos.clearFilters')}
            variant="ghost"
            size="sm"
            onPress={() => {
              clearFilter();
              setSortBy('manual');
            }}
          />
          <AnimatedButton title={t('common.done')} size="sm" onPress={onClose} />
        </>
      }
    >
      <View style={styles.group}>
        {section(t('todos.sortBy'))}
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('todos.sortBy')}>
          {TODO_SORTS.map((sort) => (
            <Chip key={sort} label={t(`todos.sort.${sort}`)} selected={sortBy === sort} onPress={() => setSortBy(sort)} />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        {section(t('todo.create.category'))}
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('todo.create.category')}>
          <Chip label={t('todos.allCategories')} selected={!filter.categoryId} onPress={() => setFilter({ categoryId: undefined })} />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={categoryName(t, category)}
              dotColor={category.color}
              selected={filter.categoryId === category.id}
              onPress={() => setFilter({ categoryId: filter.categoryId === category.id ? undefined : category.id })}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        {section(t('todo.create.priority'))}
        <View style={styles.chips}>
          {PRIORITY_CHIPS.map((priority) => (
            <Chip
              key={priority}
              label={t(PRIORITY_LABEL_KEYS[priority])}
              dotColor={priorityColor(priority, colors)}
              selected={priorities.includes(priority)}
              onPress={() => togglePriority(priority)}
              role="checkbox"
            />
          ))}
        </View>
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.sm,
  },
  // Sentence case on purpose: textTransform 'uppercase' uses the device locale, which
  // turns Turkish "i" into "I" instead of "İ".
  section: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
