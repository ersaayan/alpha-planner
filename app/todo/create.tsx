import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Button, Input } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { CategorySelect } from '@/components/todos/category-select';
import { DueDateFields } from '@/components/todos/due-date-fields';
import { enableTaskReminders } from '@/hooks/use-task-reminders';
import { useTodoStore, useCategoryStore } from '@/stores';
import type { TodoPriority } from '@/types';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { PRIORITIES, PRIORITY_LABEL_KEYS, priorityColor } from '@/constants/todo-options';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function CreateTodoScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const addTodo = useTodoStore((state) => state.addTodo);
  const addSubtask = useTodoStore((state) => state.addSubtask);
  const categories = useCategoryStore((state) => state.categories);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [due, setDue] = useState<{ dueDate: string | null; dueTime: string | null }>({ dueDate: null, dueTime: null });
  const [estimatedPomodoros, setEstimatedPomodoros] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState('');

  const addDraftSubtask = () => {
    const subtaskTitle = newSubtask.trim();
    if (!subtaskTitle) return;
    setSubtasks((current) => [...current, subtaskTitle]);
    setNewSubtask('');
  };

  const handleCreate = () => {
    if (!title.trim()) return;

    const parsedPomodoros = parseInt(estimatedPomodoros, 10);
    const estimatedPomodorosValue =
      Number.isFinite(parsedPomodoros) && parsedPomodoros > 0 ? parsedPomodoros : null;

    const todo = addTodo({
      title: title.trim(),
      description: description.trim() || null,
      dueDate: due.dueDate,
      dueTime: due.dueTime,
      status: 'pending',
      categoryId,
      priority,
      estimatedPomodoros: estimatedPomodorosValue,
    });
    // A subtask still in the input counts too.
    const pendingSubtask = newSubtask.trim();
    for (const subtaskTitle of pendingSubtask ? [...subtasks, pendingSubtask] : subtasks) {
      addSubtask(todo.id, subtaskTitle);
    }
    if (due.dueTime) void enableTaskReminders();

    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
        keyboardShouldPersistTaps="handled"
      >
      {/* Title */}
      <Input
        label={t('todo.create.taskTitle')}
        placeholder={t('todo.create.taskTitlePlaceholder')}
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        size="large"
        autoFocus
      />

      {/* Description */}
      <Input
        label={t('todo.create.description')}
        placeholder={t('todo.create.descriptionPlaceholder')}
        value={description}
        onChangeText={setDescription}
        style={styles.input}
        multiline
        numberOfLines={3}
        textStyle={{ minHeight: 80 }}
      />

      {/* Category */}
      <CategorySelect
        label={t('todo.create.category')}
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
        style={styles.input}
      />

      {/* Priority */}
      <Text category="label" style={[styles.label, { color: colors.textMuted }]}>
        {t('todo.create.priority')}
      </Text>
      <View style={styles.priorityContainer} accessibilityRole="radiogroup" accessibilityLabel={t('todo.create.priority')}>
        {PRIORITIES.map((option) => {
          const selected = option === priority;
          const color = priorityColor(option, colors);
          return (
            <Pressable
              key={option}
              style={[
                styles.priorityButton,
                {
                  backgroundColor: selected ? color + '20' : colors.card,
                  borderColor: selected ? color : colors.border,
                },
              ]}
              onPress={() => setPriority(option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <View style={[styles.priorityDot, { backgroundColor: color }]} />
              <Text category="c1" style={{ color: selected ? color : colors.text }}>
                {t(PRIORITY_LABEL_KEYS[option])}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Due date and time */}
      <DueDateFields
        label={t('todo.create.dueDate')}
        dueDate={due.dueDate}
        dueTime={due.dueTime}
        onChange={setDue}
      />

      {/* Estimated Pomodoros */}
      <Input
        label={t('todo.create.estimatedPomodoros')}
        placeholder={t('todo.create.estimatedPomodorosPlaceholder')}
        value={estimatedPomodoros}
        onChangeText={setEstimatedPomodoros}
        style={styles.input}
        keyboardType="number-pad"
        accessoryLeft={(props) => <Icon {...props} name="clock-outline" />}
      />

      {/* Subtasks */}
      <Text category="label" style={[styles.label, { color: colors.textMuted }]}>
        {t('todo.detail.subtasks')}
      </Text>
      {subtasks.map((subtaskTitle, index) => (
        <View key={`${index}-${subtaskTitle}`} style={styles.subtaskRow}>
          <Icon name="radio-button-off" fill={colors.textMuted} style={styles.subtaskIcon} />
          <Text category="p2" style={styles.subtaskText}>
            {subtaskTitle}
          </Text>
          <Pressable
            onPress={() => setSubtasks((current) => current.filter((_, i) => i !== index))}
            hitSlop={13}
            accessibilityRole="button"
            accessibilityLabel={t('todo.form.removeSubtask', { title: subtaskTitle })}
          >
            <Icon name="close-outline" fill={colors.textMuted} style={styles.subtaskIcon} />
          </Pressable>
        </View>
      ))}
      <View style={styles.subtaskRow}>
        <Input
          placeholder={t('todo.detail.addSubtask')}
          value={newSubtask}
          onChangeText={setNewSubtask}
          onSubmitEditing={addDraftSubtask}
          style={styles.subtaskInput}
          accessibilityLabel={t('todo.detail.addSubtask')}
        />
        <Button
          size="small"
          appearance="ghost"
          accessoryLeft={(props) => <Icon {...props} name="plus-outline" />}
          onPress={addDraftSubtask}
          disabled={!newSubtask.trim()}
          accessibilityLabel={t('todo.detail.addSubtask')}
          style={styles.addSubtaskButton}
        />
      </View>

      {/* Create Button */}
      <Button
        style={styles.createButton}
        size="giant"
        onPress={handleCreate}
        disabled={!title.trim()}
        accessoryLeft={(props) => <Icon {...props} name="plus-outline" />}
      >
        {t('todo.create.createButton')}
      </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
  },
  input: {
    marginBottom: Spacing.md,
  },
  label: {
    marginBottom: Spacing.xs,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  priorityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 44,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  subtaskIcon: {
    width: 18,
    height: 18,
  },
  subtaskText: {
    flex: 1,
  },
  subtaskInput: {
    flex: 1,
  },
  addSubtaskButton: {
    minWidth: 44,
    minHeight: 44,
  },
  createButton: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});
