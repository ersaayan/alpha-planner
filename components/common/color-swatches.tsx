import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Colors offered for user-made categories, with their spoken names. */
export const CATEGORY_COLORS = [
  { value: '#E57373', nameKey: 'colors.red' },
  { value: '#81C784', nameKey: 'colors.green' },
  { value: '#64B5F6', nameKey: 'colors.blue' },
  { value: '#FFB74D', nameKey: 'colors.orange' },
  { value: '#BA68C8', nameKey: 'colors.purple' },
  { value: '#4DB6AC', nameKey: 'colors.teal' },
] as const;

interface ColorSwatchesProps {
  value: string;
  onChange: (color: string) => void;
  /** Read before the swatches, e.g. "Choose a color". */
  label: string;
}

/** A row of color swatches that behaves as a radio group for screen readers. */
export function ColorSwatches({ value, onChange, label }: ColorSwatchesProps) {
  const { t } = useTranslation();
  const colors = Colors[useColorScheme() ?? 'light'];

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {CATEGORY_COLORS.map((color) => {
        const selected = value === color.value;
        return (
          <Pressable
            key={color.value}
            onPress={() => onChange(color.value)}
            style={[styles.target, selected && { borderColor: colors.text }]}
            accessibilityRole="radio"
            accessibilityLabel={t(color.nameKey)}
            accessibilityState={{ checked: selected }}
          >
            <View style={[styles.swatch, { backgroundColor: color.value }]}>
              {selected ? <Icon name="checkmark-outline" fill="#fff" style={styles.check} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  // 44pt target with a ring around the selected swatch.
  target: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 18,
    height: 18,
  },
});
