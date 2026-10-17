import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Text } from '@ui-kitten/components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { BorderRadius, Colors, FontSize, InterFonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatTime, normalizeDueTime, toTimeString } from '@/utils/todo-dates';

interface TimeFieldProps {
  label: string;
  /** `HH:mm` or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  use24Hour: boolean;
  placeholder: string;
  clearLabel: string;
  /** Time to start from when none is set yet. */
  defaultTime?: string;
}

function dateFromTime(time: string | null, fallback: string): Date {
  const [hours, minutes] = (normalizeDueTime(time) ?? fallback).split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * An optional time of day. iOS shows the system's compact picker, Android opens the
 * system time dialog, the web gets a text field (`HH:mm`).
 */
export function TimeField({ label, value, onChange, use24Hour, placeholder, clearLabel, defaultTime = '09:00' }: TimeFieldProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { i18n } = useTranslation();
  const [draft, setDraft] = useState(value ?? '');

  const openAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: dateFromTime(value, defaultTime),
      mode: 'time',
      is24Hour: use24Hour,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(toTimeString(date));
      },
    });
  };

  let control;
  if (Platform.OS === 'web') {
    control = (
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={() => {
          const time = normalizeDueTime(draft.trim());
          onChange(time);
          setDraft(time ?? '');
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        accessibilityLabel={label}
        maxLength={5}
      />
    );
  } else if (Platform.OS === 'ios' && value) {
    control = (
      <DateTimePicker
        value={dateFromTime(value, defaultTime)}
        mode="time"
        display="compact"
        // iOS has no 24-hour flag; the locale decides the clock style.
        locale={use24Hour ? 'en_GB' : 'en_US'}
        onChange={(_event, date) => {
          if (date) onChange(toTimeString(date));
        }}
        accessibilityLabel={label}
      />
    );
  } else {
    control = (
      <Pressable
        onPress={() => (Platform.OS === 'android' ? openAndroidPicker() : onChange(defaultTime))}
        style={[styles.button, { borderColor: colors.border, backgroundColor: colors.card }]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Icon name="clock-outline" fill={colors.textMuted} style={styles.icon} />
        <Text style={[styles.value, { color: value ? colors.text : colors.textMuted }]}>
          {value ? formatTime(value, use24Hour ? '24h' : '12h', i18n.language) : placeholder}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <Text category="label" style={[styles.label, { color: colors.textMuted }]}>
        {label}
      </Text>
      <View style={styles.row}>
        {control}
        {value ? (
          <Pressable
            onPress={() => {
              onChange(null);
              setDraft('');
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
          >
            <Icon name="close-circle" fill={colors.textMuted} style={styles.icon} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    marginBottom: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    minWidth: 96,
    fontFamily: InterFonts.regular,
    fontSize: FontSize.md,
  },
  icon: {
    width: 20,
    height: 20,
  },
  value: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.md,
  },
});
