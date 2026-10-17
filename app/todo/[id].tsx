import { Icon } from '@/components/icon';
import {
  Button,
  Card,
  IndexPath,
  Input,
  Select,
  SelectItem,
  Text,
} from '@ui-kitten/components';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionHeader } from '@/components/common';
import { CategorySelect } from '@/components/todos/category-select';
import { DueDateFields } from '@/components/todos/due-date-fields';
import { enableTaskReminders } from '@/hooks/use-task-reminders';
import { categoryName } from '@/services/gamification/display';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { PRIORITIES, PRIORITY_LABEL_KEYS, STATUSES, STATUS_LABEL_KEYS, priorityColor } from '@/constants/todo-options';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCategoryStore, usePomodoroStore, useSettingsStore, useTodoStore } from '@/stores';
import { formatDue, getDueDateKey } from '@/utils/todo-dates';

export default function TodoDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const todo = useTodoStore((state) => state.getTodoById(id));
  const updateTodo = useTodoStore((state) => state.updateTodo);
  const deleteTodo = useTodoStore((state) => state.deleteTodo);
  const addSubtask = useTodoStore((state) => state.addSubtask);
  const toggleSubtask = useTodoStore((state) => state.toggleSubtask);
  const updateSubtask = useTodoStore((state) => state.updateSubtask);
  const deleteSubtask = useTodoStore((state) => state.deleteSubtask);
  const categories = useCategoryStore((state) => state.categories);
  const linkTodo = usePomodoroStore((state) => state.linkTodo);
  const timer = usePomodoroStore((state) => state.timer);
  const dateFormat = useSettingsStore((state) => state.settings.dateFormat);
  const timeFormat = useSettingsStore((state) => state.settings.timeFormat);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedPriorityIndex, setSelectedPriorityIndex] = useState<IndexPath>(new IndexPath(1));
  const [selectedStatusIndex, setSelectedStatusIndex] = useState<IndexPath>(new IndexPath(0));
  const [due, setDue] = useState<{ dueDate: string | null; dueTime: string | null }>({ dueDate: null, dueTime: null });
  const [estimatedPomodoros, setEstimatedPomodoros] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  // The subtask being renamed, with its draft title.
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!todo) return;
    // Don't reset form if user is currently editing
    if (isEditing) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- form mirrors the stored todo while not editing
    setTitle(todo.title);
    setDescription(todo.description || '');
    setDue({ dueDate: getDueDateKey(todo.dueDate), dueTime: todo.dueTime ?? null });
    setEstimatedPomodoros(todo.estimatedPomodoros?.toString() || '');
    setCategoryId(categories.some((c) => c.id === todo.categoryId) ? todo.categoryId : null);

    const priorityIndex = PRIORITIES.indexOf(todo.priority);
    setSelectedPriorityIndex(new IndexPath(priorityIndex >= 0 ? priorityIndex : 1));

    const statusIndex = STATUSES.indexOf(todo.status);
    setSelectedStatusIndex(new IndexPath(statusIndex >= 0 ? statusIndex : 0));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally syncing form on specific field changes only
  }, [todo?.id, todo?.updatedAt, isEditing, categories]);

  if (!todo) {
    return (
      <View style={[styles.container, styles.notFoundContainer, { backgroundColor: colors.background }]}>
        <Text category="h6">{t('todo.notFound')}</Text>
        <Button
          appearance="outline"
          style={{ marginTop: Spacing.md }}
          accessoryLeft={(props) => <Icon {...props} name="arrow-back-outline" />}
          onPress={() => router.back()}
        >
          {t('common.back')}
        </Button>
      </View>
    );
  }

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const selectedPriority = PRIORITIES[selectedPriorityIndex.row];
  const selectedStatus = STATUSES[selectedStatusIndex.row];
  const selectedPriorityColor = priorityColor(selectedPriority, colors);

  const handleSave = () => {
    if (!title.trim()) return;

    const parsedPomodoros = parseInt(estimatedPomodoros, 10);
    const estimatedPomodorosValue =
      Number.isFinite(parsedPomodoros) && parsedPomodoros > 0 ? parsedPomodoros : null;

    updateTodo(id, {
      title: title.trim(),
      description: description.trim() || null,
      dueDate: due.dueDate,
      dueTime: due.dueTime,
      categoryId,
      priority: selectedPriority,
      status: selectedStatus,
      estimatedPomodoros: estimatedPomodorosValue,
    });
    if (due.dueTime && due.dueTime !== todo.dueTime) void enableTaskReminders();
    setIsEditing(false);
  };

  const saveRename = () => {
    if (renaming && renaming.title.trim()) updateSubtask(id, renaming.id, { title: renaming.title });
    setRenaming(null);
  };

  const handleDelete = () => {
    Alert.alert(t('todo.detail.deleteTitle'), t('todo.detail.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteTodo(id);
          router.back();
        },
      },
    ]);
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    addSubtask(id, newSubtask.trim());
    setNewSubtask('');
  };

  const handleLinkToPomodoro = () => {
    linkTodo(id);
    router.push('/(tabs)/pomodoro');
  };

  const handleUnlinkFromPomodoro = () => {
    linkTodo(null);
  };

  const completedSubtasks = todo.subtasks.filter((s) => s.isCompleted).length;
  const subtaskProgress = todo.subtasks.length > 0 ? completedSubtasks / todo.subtasks.length : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Status Badge */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text category="c1" style={{ color: colors.primary }}>
              {t(STATUS_LABEL_KEYS[selectedStatus])}
            </Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: selectedPriorityColor + '20' }]}>
            <View style={[styles.priorityDot, { backgroundColor: selectedPriorityColor }]} />
            <Text category="c1" style={{ color: selectedPriorityColor }}>
              {t(PRIORITY_LABEL_KEYS[selectedPriority])}
            </Text>
          </View>
        </View>

        {/* Title & Description */}
        {isEditing ? (
          <>
            <Input
              label={t('todo.create.taskTitle')}
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              size="large"
            />
            <Input
              label={t('todo.create.description')}
              value={description}
              onChangeText={setDescription}
              style={styles.input}
              multiline
              numberOfLines={3}
            />
          </>
        ) : (
          <View style={styles.detailSection}>
            <Text category="h5">{todo.title}</Text>
            {todo.description && (
              <Text category="p1" style={{ color: colors.textSecondary, marginTop: Spacing.xs }}>
                {todo.description}
              </Text>
            )}
          </View>
        )}

        {/* Category & Priority (Edit Mode) */}
        {isEditing && (
          <>
            <CategorySelect
              label={t('todo.detail.category')}
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              style={styles.input}
            />

            <Select
              label={t('todo.detail.priority')}
              value={t(PRIORITY_LABEL_KEYS[selectedPriority])}
              selectedIndex={selectedPriorityIndex}
              onSelect={(index) => setSelectedPriorityIndex(index as IndexPath)}
              style={styles.input}
            >
              {PRIORITIES.map((priority) => (
                <SelectItem key={priority} title={t(PRIORITY_LABEL_KEYS[priority])} />
              ))}
            </Select>

            <Select
              label={t('todo.detail.status')}
              value={t(STATUS_LABEL_KEYS[selectedStatus])}
              selectedIndex={selectedStatusIndex}
              onSelect={(index) => setSelectedStatusIndex(index as IndexPath)}
              style={styles.input}
            >
              {STATUSES.map((status) => (
                <SelectItem key={status} title={t(STATUS_LABEL_KEYS[status])} />
              ))}
            </Select>

            <DueDateFields
              label={t('todo.detail.dueDate')}
              dueDate={due.dueDate}
              dueTime={due.dueTime}
              onChange={setDue}
            />

            <Input
              label={t('todo.detail.estimatedPomodoros')}
              placeholder={t('todo.create.estimatedPomodorosPlaceholder')}
              value={estimatedPomodoros}
              onChangeText={setEstimatedPomodoros}
              style={styles.input}
              keyboardType="number-pad"
              accessoryLeft={(props) => <Icon {...props} name="clock-outline" />}
            />
          </>
        )}

        {/* Info Cards */}
        {!isEditing && (
          <View style={styles.infoCards}>
            {selectedCategory && (
              <Card style={[styles.infoCard, { backgroundColor: colors.card }]}>
                <View style={styles.infoContent}>
                  <Icon name="folder-outline" fill={colors.textMuted} style={styles.infoIcon} />
                  <Text category="s2">{categoryName(t, selectedCategory)}</Text>
                </View>
              </Card>
            )}
            {todo.dueDate && (
              <Card style={[styles.infoCard, { backgroundColor: colors.card }]}>
                <View style={styles.infoContent}>
                  <Icon name="calendar-outline" fill={colors.textMuted} style={styles.infoIcon} />
                  <Text category="s2">{formatDue(todo.dueDate, todo.dueTime, dateFormat, timeFormat, i18n.language)}</Text>
                </View>
              </Card>
            )}
            <Card style={[styles.infoCard, { backgroundColor: colors.card }]}>
              <View style={styles.infoContent}>
                <Icon name="clock-outline" fill={colors.textMuted} style={styles.infoIcon} />
                <Text category="s2">
                  {t('todo.detail.pomodoroCount', { count: todo.pomodoroSessions })}
                </Text>
              </View>
            </Card>
          </View>
        )}

        {/* Subtasks */}
        <View style={styles.section}>
          <SectionHeader
            title={t('todo.detail.subtasks')}
            action={
              todo.subtasks.length > 0 ? (
                <Text category="c1" style={{ color: colors.textMuted }}>
                  {completedSubtasks}/{todo.subtasks.length}
                </Text>
              ) : undefined
            }
          />

          {todo.subtasks.length > 0 && (
            <View style={[styles.progressBar, { backgroundColor: colors.separator }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${subtaskProgress * 100}%`, backgroundColor: colors.primary },
                ]}
              />
            </View>
          )}

          {todo.subtasks.map((subtask) => (
            <View key={subtask.id} style={styles.subtaskItem} accessibilityRole="none">
              <Pressable
                style={[
                  styles.checkbox,
                  {
                    borderColor: subtask.isCompleted ? colors.primary : colors.textMuted,
                    backgroundColor: subtask.isCompleted ? colors.primary : 'transparent',
                  },
                ]}
                onPress={() => toggleSubtask(id, subtask.id)}
                hitSlop={11}
                accessibilityRole="checkbox"
                accessibilityLabel={subtask.title}
                accessibilityState={{ checked: subtask.isCompleted }}
                accessibilityHint={subtask.isCompleted ? t('todo.form.markIncompleteHint') : t('todo.form.markCompleteHint')}
              >
                {subtask.isCompleted && (
                  <Icon name="checkmark-outline" fill={colors.onPrimary} style={styles.checkIcon} />
                )}
              </Pressable>
              {renaming?.id === subtask.id ? (
                <Input
                  value={renaming.title}
                  onChangeText={(title) => setRenaming({ id: subtask.id, title })}
                  onSubmitEditing={saveRename}
                  onBlur={saveRename}
                  autoFocus
                  style={styles.subtaskText}
                  accessibilityLabel={t('todo.form.renameSubtask')}
                />
              ) : (
                <Pressable
                  style={styles.subtaskText}
                  onPress={() => setRenaming({ id: subtask.id, title: subtask.title })}
                  accessibilityRole="button"
                  accessibilityLabel={subtask.title}
                  accessibilityHint={t('todo.form.renameSubtaskHint')}
                >
                  <Text
                    category="p2"
                    style={subtask.isCompleted ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}
                  >
                    {subtask.title}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => deleteSubtask(id, subtask.id)}
                style={styles.subtaskDeleteButton}
                accessibilityRole="button"
                accessibilityLabel={t('todo.form.deleteSubtask', { title: subtask.title })}
              >
                <Icon name="close-outline" fill={colors.textMuted} style={styles.deleteIcon} />
              </Pressable>
            </View>
          ))}

          <View style={styles.addSubtaskRow}>
            <Input
              placeholder={t('todo.detail.addSubtask')}
              value={newSubtask}
              onChangeText={setNewSubtask}
              style={styles.subtaskInput}
              onSubmitEditing={handleAddSubtask}
              accessibilityLabel={t('todo.detail.addSubtask')}
            />
            <Button
              size="small"
              appearance="ghost"
              accessoryLeft={(props) => <Icon {...props} name="plus-outline" />}
              onPress={handleAddSubtask}
              disabled={!newSubtask.trim()}
              accessibilityLabel={t('todo.detail.addSubtask')}
              style={styles.addSubtaskButton}
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {isEditing ? (
            <>
              <Button appearance="ghost" onPress={() => setIsEditing(false)}>
                {t('common.cancel')}
              </Button>
              <Button onPress={handleSave} disabled={!title.trim()}>{t('todo.saveChanges')}</Button>
            </>
          ) : (
            <>
              <Button
                appearance="outline"
                accessoryLeft={(props) => <Icon {...props} name="edit-outline" />}
                onPress={() => setIsEditing(true)}
              >
                {t('todo.detail.edit')}
              </Button>
              {timer.linkedTodoId === id ? (
                <Button
                  appearance="ghost"
                  status="basic"
                  accessoryLeft={(props) => <Icon {...props} name="close-outline" />}
                  onPress={handleUnlinkFromPomodoro}
                >
                  {t('pomodoro.unlink')}
                </Button>
              ) : (
                <Button
                  accessoryLeft={(props) => <Icon {...props} name="clock-outline" />}
                  onPress={handleLinkToPomodoro}
                >
                  {t('todo.detail.startFocus')}
                </Button>
              )}
            </>
          )}
        </View>

        {/* Delete */}
        <Button
          appearance="ghost"
          status="danger"
          accessoryLeft={(props) => <Icon {...props} name="trash-2-outline" />}
          onPress={handleDelete}
          style={styles.deleteButton}
        >
          {t('todo.detail.deleteTitle')}
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
  notFoundContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detailSection: {
    marginBottom: Spacing.lg,
  },
  input: {
    marginBottom: Spacing.md,
  },
  infoCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  infoCard: {
    borderRadius: BorderRadius.md,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  infoIcon: {
    width: 16,
    height: 16,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xxs,
    gap: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    width: 14,
    height: 14,
  },
  subtaskText: {
    flex: 1,
  },
  subtaskDeleteButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    width: 20,
    height: 20,
  },
  addSubtaskButton: {
    minWidth: 44,
    minHeight: 44,
  },
  addSubtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  subtaskInput: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  deleteButton: {
    marginTop: Spacing.md,
  },
});
