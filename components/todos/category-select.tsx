import { IndexPath, Select, SelectItem } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { categoryName } from '@/services/gamification/display';
import { Spacing } from '@/constants/theme';
import type { Category } from '@/types';

interface CategorySelectProps {
  label: string;
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
  style?: ViewStyle;
}

/** Category picker whose first option is "No category", so a category can be removed. */
export function CategorySelect({ label, categories, value, onChange, style }: CategorySelectProps) {
  const { t } = useTranslation();
  const index = categories.findIndex((category) => category.id === value);
  const selected = index >= 0 ? categories[index] : null;

  return (
    <Select
      label={label}
      placeholder={t('todo.create.categoryPlaceholder')}
      value={selected ? categoryName(t, selected) : t('todo.form.noCategory')}
      selectedIndex={new IndexPath(index + 1)}
      onSelect={(selection) => {
        const row = (selection as IndexPath).row;
        onChange(row === 0 ? null : (categories[row - 1]?.id ?? null));
      }}
      style={style}
      accessoryLeft={selected ? () => <View style={[styles.dot, { backgroundColor: selected.color }]} /> : undefined}
    >
      {[
        <SelectItem key="none" title={t('todo.form.noCategory')} />,
        ...categories.map((category) => (
          <SelectItem
            key={category.id}
            title={categoryName(t, category)}
            accessoryLeft={() => <View style={[styles.dot, { backgroundColor: category.color }]} />}
          />
        )),
      ]}
    </Select>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.xs,
  },
});
