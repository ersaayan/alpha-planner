import { useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Button, Input, Select, SelectItem, IndexPath, Datepicker } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTodoStore, useCategoryStore } from '@/stores';
import type { TodoPriority } from '@/types';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const PRIORITIES: { value: TodoPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#90AB8B' },
  { value: 'medium', label: 'Medium', color: '#B5A45E' },
  { value: 'high', label: 'High', color: '#E47F7F' },
  { value: 'urgent', label: 'Urgent', color: '#D85656' },
];

export default function CreateTodoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const addTodo = useTodoStore((state) => state.addTodo);
  const todos = useTodoStore((state) => state.todos);
  const categories = useCategoryStore((state) => state.categories);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<IndexPath | undefined>();
  const [selectedPriorityIndex, setSelectedPriorityIndex] = useState<IndexPath>(new IndexPath(1));
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [estimatedPomodoros, setEstimatedPomodoros] = useState('');

  const selectedCategory = selectedCategoryIndex
    ? categories[selectedCategoryIndex.row]
    : null;
  const selectedPriority = PRIORITIES[selectedPriorityIndex.row];

  const handleCreate = () => {
    if (!title.trim()) return;

    addTodo({
      title: title.trim(),
      description: description.trim() || null,
      dueDate: dueDate?.toISOString() || null,
      status: 'pending',
      categoryId: selectedCategory?.id || null,
      priority: selectedPriority.value,
      estimatedPomodoros: estimatedPomodoros ? parseInt(estimatedPomodoros, 10) : null,
      completedAt: null,
      order: todos.length,
    });

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
        label="Task Title"
        placeholder="What do you need to do?"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        size="large"
        autoFocus
      />

      {/* Description */}
      <Input
        label="Description (optional)"
        placeholder="Add more details..."
        value={description}
        onChangeText={setDescription}
        style={styles.input}
        multiline
        numberOfLines={3}
        textStyle={{ minHeight: 80 }}
      />

      {/* Category */}
      <Select
        label="Category"
        placeholder="Select a category"
        value={selectedCategory?.name}
        selectedIndex={selectedCategoryIndex}
        onSelect={(index) => setSelectedCategoryIndex(index as IndexPath)}
        style={styles.input}
        accessoryLeft={
          selectedCategory
            ? () => (
                <View
                  style={[
                    styles.categoryDot,
                    { backgroundColor: selectedCategory.color },
                  ]}
                />
              )
            : undefined
        }
      >
        {categories.map((category) => (
          <SelectItem
            key={category.id}
            title={category.name}
            accessoryLeft={() => (
              <View
                style={[styles.categoryDot, { backgroundColor: category.color }]}
              />
            )}
          />
        ))}
      </Select>

      {/* Priority */}
      <Text category="label" style={styles.label}>
        Priority
      </Text>
      <View style={styles.priorityContainer}>
        {PRIORITIES.map((priority, index) => (
          <Pressable
            key={priority.value}
            style={[
              styles.priorityButton,
              {
                backgroundColor:
                  selectedPriorityIndex.row === index
                    ? priority.color + '20'
                    : colors.card,
                borderColor:
                  selectedPriorityIndex.row === index ? priority.color : colors.border,
              },
            ]}
            onPress={() => setSelectedPriorityIndex(new IndexPath(index))}
          >
            <View style={[styles.priorityDot, { backgroundColor: priority.color }]} />
            <Text
              category="c1"
              style={{
                color: selectedPriorityIndex.row === index ? priority.color : colors.text,
              }}
            >
              {priority.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Due Date */}
      <Datepicker
        label="Due Date (optional)"
        placeholder="Pick a date"
        date={dueDate}
        onSelect={(date) => setDueDate(date)}
        style={styles.input}
        accessoryRight={(props) => <Icon {...props} name="calendar-outline" />}
        min={new Date()}
      />

      {/* Estimated Pomodoros */}
      <Input
        label="Estimated Pomodoros (optional)"
        placeholder="e.g., 4"
        value={estimatedPomodoros}
        onChangeText={setEstimatedPomodoros}
        style={styles.input}
        keyboardType="number-pad"
        accessoryLeft={(props) => <Icon {...props} name="clock-outline" />}
      />

      {/* Create Button */}
      <Button
        style={styles.createButton}
        size="giant"
        onPress={handleCreate}
        disabled={!title.trim()}
        accessoryLeft={(props) => <Icon {...props} name="plus-outline" />}
      >
        Create Task
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
    color: '#8F9BB3',
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
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.xs,
  },
  createButton: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});
