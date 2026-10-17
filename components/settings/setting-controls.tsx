import Slider from '@react-native-community/slider';
import { Text, Toggle } from '@ui-kitten/components';
import { Pressable, StyleSheet, View } from 'react-native';

import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SettingToggleProps {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A labelled on/off row: the switch is announced with the row's title and description. */
export function SettingToggle({ title, description, checked, onChange }: SettingToggleProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  return (
    <View style={styles.row}>
      <View style={styles.info} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text category="s1">{title}</Text>
        {description ? (
          <Text category="c1" style={{ color: colors.textMuted }}>
            {description}
          </Text>
        ) : null}
      </View>
      <Toggle
        checked={checked}
        onChange={onChange}
        accessibilityLabel={title}
        accessibilityHint={description}
      />
    </View>
  );
}

interface SettingSliderProps {
  title: string;
  description?: string;
  /** The current value in words, e.g. "25 min". */
  valueText: string;
  value: number;
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  color: string;
  onComplete: (value: number) => void;
}

/** A labelled slider with its value and range; screen readers hear the value text. */
export function SettingSlider({
  title,
  description,
  valueText,
  value,
  min,
  max,
  step,
  minLabel,
  maxLabel,
  color,
  onComplete,
}: SettingSliderProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text category="s1">{title}</Text>
          {description ? (
            <Text category="c1" style={{ color: colors.textMuted }}>
              {description}
            </Text>
          ) : null}
        </View>
        <Text category="s1" style={{ color: colors.primary }}>
          {valueText}
        </Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onSlidingComplete={onComplete}
        minimumTrackTintColor={color}
        maximumTrackTintColor={colors.border}
        thumbTintColor={color}
        accessibilityLabel={title}
        accessibilityValue={{ min, max, now: value, text: valueText }}
      />
      <View style={styles.range} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text category="c1" style={{ color: colors.textMuted }}>
          {minLabel}
        </Text>
        <Text category="c1" style={{ color: colors.textMuted }}>
          {maxLabel}
        </Text>
      </View>
    </View>
  );
}

interface OptionPillsProps<T extends string | number> {
  /** What is being chosen (read as the group's name). */
  label: string;
  options: readonly { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}

/** A single-choice row of pills, exposed as a radio group with the checked option. */
export function OptionPills<T extends string | number>({ label, options, selected, onSelect }: OptionPillsProps<T>) {
  const colors = Colors[useColorScheme() ?? 'light'];
  return (
    <View>
      <Text category="s1" style={styles.groupLabel}>
        {label}
      </Text>
      <View style={styles.pills} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const isSelected = option.value === selected;
          return (
            <Pressable
              key={String(option.value)}
              style={[
                styles.pill,
                {
                  backgroundColor: isSelected ? colors.primary + '20' : colors.backgroundSecondary,
                  borderColor: isSelected ? colors.primary : 'transparent',
                },
              ]}
              onPress={() => onSelect(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
            >
              <Text category="c1" style={{ color: isSelected ? colors.primary : colors.text }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: Spacing.xs,
  },
  info: {
    flex: 1,
    marginRight: Spacing.md,
  },
  slider: {
    width: '100%',
    height: 44,
  },
  range: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  groupLabel: {
    paddingVertical: Spacing.xs,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
