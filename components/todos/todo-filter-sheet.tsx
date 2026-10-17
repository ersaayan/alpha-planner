import { Text } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AnimatedButton } from '@/components/animated/animated-button';
import { SheetModal } from '@/components/common/sheet-modal';
import { BorderRadius, Colors, FontSize, InterFonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { categoryName } from '@/services/gamification/display';
import { useCategoryStore, useTodoStore } from '@/stores';
import type { TodoPriority } from '@/types';
import { TODO_SORTS } from '@/utils/todo-list';

const PRIORITIES: TodoPriority[] = ['urgent', 'high', 'medium', 'low'];
const PRIORITY_LABELS: Record<TodoPriority, string> = {
  urgent: 'todo.create.priorityUrgent',
  high: 'todo.create.priorityHigh',
  medium: 'todo.create.priorityMedium',
  low: 'todo.create.priorityLow',
};

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}

function Chip({ label, selected, onPress, color }: ChipProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const accent = color ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? accent : colors.border, backgroundColor: selected ? accent + '20' : colors.card },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.chipText, { color: selected ? accent : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

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

  return (
    <SheetModal
      visible={visible}
      title={t('todos.filterTitle')}
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
      <Text style={[styles.section, { color: colors.textSecondary }]}>{t('todos.sortBy')}</Text>
      <View style={styles.chips}>
        {TODO_SORTS.map((sort) => (
          <Chip key={sort} label={t(`todos.sort.${sort}`)} selected={sortBy === sort} onPress={() => setSortBy(sort)} />
        ))}
      </View>

      <Text style={[styles.section, { color: colors.textSecondary }]}>{t('todo.create.category')}</Text>
      <View style={styles.chips}>
        <Chip label={t('todos.allCategories')} selected={!filter.categoryId} onPress={() => setFilter({ categoryId: undefined })} />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={categoryName(t, category)}
            color={category.color}
            selected={filter.categoryId === category.id}
            onPress={() => setFilter({ categoryId: filter.categoryId === category.id ? undefined : category.id })}
          />
        ))}
      </View>

      <Text style={[styles.section, { color: colors.textSecondary }]}>{t('todo.create.priority')}</Text>
      <View style={styles.chips}>
        {PRIORITIES.map((priority) => (
          <Chip
            key={priority}
            label={t(PRIORITY_LABELS[priority])}
            selected={priorities.includes(priority)}
            onPress={() => togglePriority(priority)}
          />
        ))}
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  section: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    minHeight: 36,
  },
  chipText: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
