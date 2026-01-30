import { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Text,
  Button,
  Input,
  Select,
  SelectItem,
  IndexPath,
  Datepicker,
  Card,
} from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useTodoStore, useCategoryStore, usePomodoroStore, useSettingsStore } from '@/stores';
import type { TodoPriority, TodoStatus } from '@/types';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDate } from '@/utils/date';

const PRIORITIES: { value: TodoPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#90AB8B' },
  { value: 'medium', label: 'Medium', color: '#B5A45E' },
  { value: 'high', label: 'High', color: '#E47F7F' },
  { value: 'urgent', label: 'Urgent', color: '#D85656' },
];

const STATUSES: { value: TodoStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

export default function TodoDetailScreen() {
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
  const deleteSubtask = useTodoStore((state) => state.deleteSubtask);
  const categories = useCategoryStore((state) => state.categories);
  const linkTodo = usePomodoroStore((state) => state.linkTodo);
  const timer = usePomodoroStore((state) => state.timer);
  const dateFormat = useSettingsStore((state) => state.settings.dateFormat);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<IndexPath | undefined>();
  const [selectedPriorityIndex, setSelectedPriorityIndex] = useState<IndexPath>(new IndexPath(1));
  const [selectedStatusIndex, setSelectedStatusIndex] = useState<IndexPath>(new IndexPath(0));
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [newSubtask, setNewSubtask] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (todo) {
      setTitle(todo.title);
      setDescription(todo.description || '');
      setDueDate(todo.dueDate ? new Date(todo.dueDate) : null);

      const categoryIndex = categories.findIndex((c) => c.id === todo.categoryId);
      if (categoryIndex >= 0) {
        setSelectedCategoryIndex(new IndexPath(categoryIndex));
      }

      const priorityIndex = PRIORITIES.findIndex((p) => p.value === todo.priority);
      setSelectedPriorityIndex(new IndexPath(priorityIndex >= 0 ? priorityIndex : 1));

      const statusIndex = STATUSES.findIndex((s) => s.value === todo.status);
      setSelectedStatusIndex(new IndexPath(statusIndex >= 0 ? statusIndex : 0));
    }
  }, [todo, categories]);

  if (!todo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text category="h6">Todo not found</Text>
      </View>
    );
  }

  const selectedCategory = selectedCategoryIndex
    ? categories[selectedCategoryIndex.row]
    : null;
  const selectedPriority = PRIORITIES[selectedPriorityIndex.row];
  const selectedStatus = STATUSES[selectedStatusIndex.row];

  const handleSave = () => {
    updateTodo(id, {
      title: title.trim(),
      description: description.trim() || null,
      dueDate: dueDate?.toISOString() || null,
      categoryId: selectedCategory?.id || null,
      priority: selectedPriority.value,
      status: selectedStatus.value,
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
            {selectedStatus.label}
          </Text>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: selectedPriority.color + '20' }]}>
          <View style={[styles.priorityDot, { backgroundColor: selectedPriority.color }]} />
          <Text category="c1" style={{ color: selectedPriority.color }}>
            {selectedPriority.label}
          </Text>
        </View>
      </View>

      {/* Title & Description */}
      {isEditing ? (
        <>
          <Input
            label="Title"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            size="large"
          />
          <Input
            label="Description"
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
          <Select
            label="Category"
            placeholder="Select a category"
            value={selectedCategory?.name}
            selectedIndex={selectedCategoryIndex}
            onSelect={(index) => setSelectedCategoryIndex(index as IndexPath)}
            style={styles.input}
          >
            {categories.map((category) => (
              <SelectItem key={category.id} title={category.name} />
            ))}
          </Select>

          <Select
            label="Priority"
            value={selectedPriority.label}
            selectedIndex={selectedPriorityIndex}
            onSelect={(index) => setSelectedPriorityIndex(index as IndexPath)}
            style={styles.input}
          >
            {PRIORITIES.map((priority) => (
              <SelectItem key={priority.value} title={priority.label} />
            ))}
          </Select>

          <Select
            label="Status"
            value={selectedStatus.label}
            selectedIndex={selectedStatusIndex}
            onSelect={(index) => setSelectedStatusIndex(index as IndexPath)}
            style={styles.input}
          >
            {STATUSES.map((status) => (
              <SelectItem key={status.value} title={status.label} />
            ))}
          </Select>

          <Datepicker
            label="Due Date"
            placeholder="Pick a date"
            date={dueDate}
            onSelect={(date) => setDueDate(date)}
            style={styles.input}
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
                <Text category="s2">{selectedCategory.name}</Text>
              </View>
            </Card>
          )}
          {todo.dueDate && (
            <Card style={[styles.infoCard, { backgroundColor: colors.card }]}>
              <View style={styles.infoContent}>
                <Icon name="calendar-outline" fill={colors.textMuted} style={styles.infoIcon} />
                <Text category="s2">{formatDate(new Date(todo.dueDate), dateFormat)}</Text>
              </View>
            </Card>
          )}
          <Card style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <View style={styles.infoContent}>
              <Icon name="clock-outline" fill={colors.textMuted} style={styles.infoIcon} />
              <Text category="s2">
                {todo.pomodoroSessions} {todo.pomodoroSessions === 1 ? 'pomodoro' : 'pomodoros'}
              </Text>
            </View>
          </Card>
        </View>
      )}

      {/* Subtasks */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text category="s1">Subtasks</Text>
          {todo.subtasks.length > 0 && (
            <Text category="c1" style={{ color: colors.textMuted }}>
              {completedSubtasks}/{todo.subtasks.length}
            </Text>
          )}
        </View>

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
                  borderColor: subtask.isCompleted ? colors.primary : colors.border,
                  backgroundColor: subtask.isCompleted ? colors.primary : 'transparent',
                },
              ]}
              onPress={() => toggleSubtask(id, subtask.id)}
              accessibilityRole="checkbox"
              accessibilityLabel={subtask.title}
              accessibilityState={{ checked: subtask.isCompleted }}
              accessibilityHint={subtask.isCompleted ? 'Double tap to mark as incomplete' : 'Double tap to mark as complete'}
            >
              {subtask.isCompleted && (
                <Icon name="checkmark-outline" fill="#fff" style={styles.checkIcon} />
              )}
            </Pressable>
            <Text
              category="p2"
              style={[
                styles.subtaskText,
                subtask.isCompleted && { textDecorationLine: 'line-through', opacity: 0.6 },
              ]}
              accessibilityElementsHidden
            >
              {subtask.title}
            </Text>
            <Pressable
              onPress={() => deleteSubtask(id, subtask.id)}
              accessibilityRole="button"
              accessibilityLabel={`Delete subtask: ${subtask.title}`}
            >
              <Icon name="close-outline" fill={colors.textMuted} style={styles.deleteIcon} />
            </Pressable>
          </View>
        ))}

        <View style={styles.addSubtaskRow}>
          <Input
            placeholder="Add a subtask..."
            value={newSubtask}
            onChangeText={setNewSubtask}
            style={styles.subtaskInput}
            onSubmitEditing={handleAddSubtask}
          />
          <Button
            size="small"
            appearance="ghost"
            accessoryLeft={(props) => <Icon {...props} name="plus-outline" />}
            onPress={handleAddSubtask}
            disabled={!newSubtask.trim()}
          />
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {isEditing ? (
          <>
            <Button appearance="ghost" onPress={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onPress={handleSave}>Save Changes</Button>
          </>
        ) : (
          <>
            <Button
              appearance="outline"
              accessoryLeft={(props) => <Icon {...props} name="edit-outline" />}
              onPress={() => setIsEditing(true)}
            >
              Edit
            </Button>
            {timer.linkedTodoId === id ? (
              <Button
                appearance="ghost"
                status="basic"
                accessoryLeft={(props) => <Icon {...props} name="close-outline" />}
                onPress={handleUnlinkFromPomodoro}
              >
                Unlink
              </Button>
            ) : (
              <Button
                accessoryLeft={(props) => <Icon {...props} name="clock-outline" />}
                onPress={handleLinkToPomodoro}
              >
                Start Focus
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
        Delete Task
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
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
    paddingVertical: Spacing.sm,
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
  deleteIcon: {
    width: 18,
    height: 18,
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
