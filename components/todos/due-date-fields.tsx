import { Datepicker } from '@ui-kitten/components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { TimeField } from '@/components/common/time-field';
import { Icon } from '@/components/icon';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createDateService } from '@/services/i18n/date-service';
import { useSettingsStore } from '@/stores';
import { getDateKey, parseDateKey } from '@/utils/date';
import { resolveWeekStart } from '@/utils/locale';

interface DueDateFieldsProps {
  /** `yyyy-MM-dd` or null. */
  dueDate: string | null;
  /** `HH:mm` or null. */
  dueTime: string | null;
  onChange: (value: { dueDate: string | null; dueTime: string | null }) => void;
  label: string;
}

/** Optional due date (clearable) and, once a date is set, an optional due time. */
export function DueDateFields({ dueDate, dueTime, onChange, label }: DueDateFieldsProps) {
  const { t, i18n } = useTranslation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const use24Hour = useSettingsStore((state) => state.settings.timeFormat) !== '12h';
  const weekStartSetting = useSettingsStore((state) => state.settings.weekStartsOn);
  const dateFormat = useSettingsStore((state) => state.settings.dateFormat);
  const weekStartsOn = resolveWeekStart(weekStartSetting, i18n.language);
  const dateService = useMemo(
    () => createDateService(i18n.language, weekStartsOn, dateFormat),
    [i18n.language, weekStartsOn, dateFormat]
  );
  const date = dueDate ? parseDateKey(dueDate) : null;
  const today = parseDateKey(getDateKey());

  return (
    <View>
      <View style={styles.dateRow}>
        <Datepicker
          label={label}
          placeholder={t('todo.create.dueDatePlaceholder')}
          date={date}
          dateService={dateService}
          onSelect={(selected) => {
            if (selected) onChange({ dueDate: getDateKey(selected), dueTime });
          }}
          style={styles.date}
          accessoryRight={(props) => <Icon {...props} name="calendar-outline" />}
          // Past dates stay selectable for a task that is already overdue.
          min={date && date < today ? date : today}
          max={new Date(today.getFullYear() + 10, 11, 31)}
        />
        {dueDate ? (
          <Pressable
            onPress={() => onChange({ dueDate: null, dueTime: null })}
            hitSlop={12}
            style={styles.clear}
            accessibilityRole="button"
            accessibilityLabel={t('todo.form.clearDueDate')}
          >
            <Icon name="close-circle" fill={colors.textMuted} style={styles.clearIcon} />
          </Pressable>
        ) : null}
      </View>
      {dueDate ? (
        <TimeField
          label={t('todo.form.dueTime')}
          value={dueTime}
          onChange={(time) => onChange({ dueDate, dueTime: time })}
          use24Hour={use24Hour}
          placeholder={t('todo.form.addTime')}
          clearLabel={t('todo.form.clearDueTime')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  date: {
    flex: 1,
  },
  clear: {
    paddingBottom: Spacing.sm + 2,
  },
  clearIcon: {
    width: 22,
    height: 22,
  },
});
