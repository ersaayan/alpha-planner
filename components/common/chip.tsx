import { Text } from '@ui-kitten/components';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { BorderRadius, Colors, FontSize, InterFonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** A color dot before the label (categories, priorities). */
  dotColor?: string;
  /** 'radio' in single-choice groups, 'checkbox' in multi-choice ones. */
  role?: 'radio' | 'checkbox';
  testID?: string;
}

/**
 * A selectable pill used by the filter sheet and the goal editor. Selected chips are
 * filled with a primary tint and show a check mark, so the state does not rely on
 * color alone.
 */
export function Chip({ label, selected, onPress, dotColor, role = 'radio', testID }: ChipProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary + '20' : colors.card,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      testID={testID}
    >
      {selected ? <Icon name="checkmark" fill={colors.primary} size={14} /> : null}
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text style={[styles.label, { color: selected ? colors.primary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
  },
  pressed: {
    opacity: 0.7,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
  },
});
