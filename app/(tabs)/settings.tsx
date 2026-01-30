import { useState } from 'react';
import { StyleSheet, View, ScrollView, Alert, Pressable } from 'react-native';
import { Text, Card, Toggle, Button, Divider, Input } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';

import { useCategoryStore, useSettingsStore } from '@/stores';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const EXTRA_COLORS = ['#E57373', '#81C784', '#64B5F6', '#FFB74D', '#BA68C8', '#4DB6AC'];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const settings = useSettingsStore((state) => state.settings);
  const pomodoroSettings = useSettingsStore((state) => state.pomodoroSettings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const updatePomodoroSettings = useSettingsStore((state) => state.updatePomodoroSettings);
  const categories = useCategoryStore((state) => state.categories);
  const addCategory = useCategoryStore((state) => state.addCategory);
  const deleteCategory = useCategoryStore((state) => state.deleteCategory);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState(EXTRA_COLORS[0]);

  const formatDuration = (seconds: number) => {
    return `${Math.floor(seconds / 60)} min`;
  };

  const focusMinutes = Math.round(pomodoroSettings.focusDuration / 60);
  const shortBreakMinutes = Math.round(pomodoroSettings.shortBreakDuration / 60);
  const longBreakMinutes = Math.round(pomodoroSettings.longBreakDuration / 60);

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset Onboarding',
      'This will show the onboarding screens again on next app launch.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => updateSettings({ hasCompletedOnboarding: false }),
        },
      ]
    );
  };

  const handleAddCategory = () => {
    if (!categoryName.trim()) return;

    addCategory({
      name: categoryName.trim(),
      color: categoryColor,
      icon: 'folder-outline',
      order: categories.length,
    });

    setCategoryName('');
    setShowCategoryForm(false);
  };

  const handleDeleteCategory = (categoryId: string) => {
    Alert.alert('Delete Category', 'Are you sure you want to delete this category?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteCategory(categoryId),
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingBottom: insets.bottom + 100,
      }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text category="h5">Settings</Text>
      </View>

      {/* Pomodoro Settings */}
      <Text category="s1" style={styles.sectionTitle}>
        Pomodoro Timer
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">Focus Duration</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              How long each focus session lasts
            </Text>
          </View>
          <Text category="s1" style={{ color: colors.primary }}>
            {formatDuration(pomodoroSettings.focusDuration)}
          </Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={15}
          maximumValue={60}
          step={5}
          value={focusMinutes}
          onValueChange={(value) => updatePomodoroSettings({ focusDuration: value * 60 })}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
        <View style={styles.sliderRange}>
          <Text category="c1" style={{ color: colors.textMuted }}>
            15 min
          </Text>
          <Text category="c1" style={{ color: colors.textMuted }}>
            60 min
          </Text>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">Short Break</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              Break after each focus session
            </Text>
          </View>
          <Text category="s1" style={{ color: colors.primary }}>
            {formatDuration(pomodoroSettings.shortBreakDuration)}
          </Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={3}
          maximumValue={15}
          step={1}
          value={shortBreakMinutes}
          onValueChange={(value) => updatePomodoroSettings({ shortBreakDuration: value * 60 })}
          minimumTrackTintColor={colors.secondary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.secondary}
        />
        <View style={styles.sliderRange}>
          <Text category="c1" style={{ color: colors.textMuted }}>
            3 min
          </Text>
          <Text category="c1" style={{ color: colors.textMuted }}>
            15 min
          </Text>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">Long Break</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              Break after {pomodoroSettings.sessionsUntilLongBreak} sessions
            </Text>
          </View>
          <Text category="s1" style={{ color: colors.primary }}>
            {formatDuration(pomodoroSettings.longBreakDuration)}
          </Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={10}
          maximumValue={30}
          step={5}
          value={longBreakMinutes}
          onValueChange={(value) => updatePomodoroSettings({ longBreakDuration: value * 60 })}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.accent}
        />
        <View style={styles.sliderRange}>
          <Text category="c1" style={{ color: colors.textMuted }}>
            10 min
          </Text>
          <Text category="c1" style={{ color: colors.textMuted }}>
            30 min
          </Text>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">Sessions Until Long Break</Text>
          </View>
          <Text category="s1" style={{ color: colors.primary }}>
            {pomodoroSettings.sessionsUntilLongBreak}
          </Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={2}
          maximumValue={6}
          step={1}
          value={pomodoroSettings.sessionsUntilLongBreak}
          onValueChange={(value) => updatePomodoroSettings({ sessionsUntilLongBreak: value })}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
        <View style={styles.sliderRange}>
          <Text category="c1" style={{ color: colors.textMuted }}>
            2
          </Text>
          <Text category="c1" style={{ color: colors.textMuted }}>
            6
          </Text>
        </View>
      </Card>

      {/* Timer Behavior */}
      <Text category="s1" style={styles.sectionTitle}>
        Timer Behavior
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">Auto-start Breaks</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              Automatically start break after focus
            </Text>
          </View>
          <Toggle
            checked={pomodoroSettings.autoStartBreaks}
            onChange={(checked) => updatePomodoroSettings({ autoStartBreaks: checked })}
          />
        </View>

        <Divider style={styles.divider} />

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">Auto-start Focus</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              Automatically start focus after break
            </Text>
          </View>
          <Toggle
            checked={pomodoroSettings.autoStartFocus}
            onChange={(checked) => updatePomodoroSettings({ autoStartFocus: checked })}
          />
        </View>

        <Divider style={styles.divider} />

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">Keep Screen Awake</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              Prevent screen from sleeping during timer
            </Text>
          </View>
          <Toggle
            checked={pomodoroSettings.keepScreenAwake}
            onChange={(checked) => updatePomodoroSettings({ keepScreenAwake: checked })}
          />
        </View>
      </Card>

      {/* Notifications */}
      <Text category="s1" style={styles.sectionTitle}>
        Notifications
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">Enable Notifications</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              Get notified when timer completes
            </Text>
          </View>
          <Toggle
            checked={settings.notificationsEnabled}
            onChange={(checked) => updateSettings({ notificationsEnabled: checked })}
          />
        </View>

        <Divider style={styles.divider} />

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">Sound</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              Play sound on completion
            </Text>
          </View>
          <Toggle
            checked={settings.soundEnabled}
            onChange={(checked) => updateSettings({ soundEnabled: checked })}
          />
        </View>

        <Divider style={styles.divider} />

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">Vibration</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              Vibrate on completion
            </Text>
          </View>
          <Toggle
            checked={pomodoroSettings.vibrationEnabled}
            onChange={(checked) => updatePomodoroSettings({ vibrationEnabled: checked })}
          />
        </View>
      </Card>

      {/* App Settings */}
      <Text category="s1" style={styles.sectionTitle}>
        App
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">Haptic Feedback</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              Tactile feedback on interactions
            </Text>
          </View>
          <Toggle
            checked={settings.hapticFeedbackEnabled}
            onChange={(checked) => updateSettings({ hapticFeedbackEnabled: checked })}
          />
        </View>
      </Card>

      {/* Categories */}
      <Text category="s1" style={styles.sectionTitle}>
        Categories
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        {categories.map((category) => (
          <View key={category.id} style={styles.categoryRow}>
            <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
            <Text category="s1" style={styles.categoryName}>
              {category.name}
            </Text>
            {!category.isDefault && (
              <Pressable onPress={() => handleDeleteCategory(category.id)}>
                <Icon name="trash-2-outline" fill={colors.textMuted} style={styles.categoryDelete} />
              </Pressable>
            )}
          </View>
        ))}

        <Divider style={styles.divider} />

        {!showCategoryForm ? (
          <Button
            appearance="ghost"
            status="basic"
            accessoryLeft={(props) => <Icon {...props} name="plus-outline" />}
            onPress={() => setShowCategoryForm(true)}
          >
            Add Category
          </Button>
        ) : (
          <View style={styles.categoryForm}>
            <Input
              label="Category Name"
              placeholder="e.g., Side Projects"
              value={categoryName}
              onChangeText={setCategoryName}
              style={{ marginBottom: Spacing.md }}
            />
            <Text category="c1" style={{ marginBottom: Spacing.sm }}>
              Choose Color
            </Text>
            <View style={styles.colorPicker}>
              {EXTRA_COLORS.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    categoryColor === color && styles.colorSelected,
                  ]}
                  onPress={() => setCategoryColor(color)}
                />
              ))}
            </View>
            <View style={styles.formButtons}>
              <Button appearance="ghost" size="small" onPress={() => setShowCategoryForm(false)}>
                Cancel
              </Button>
              <Button size="small" onPress={handleAddCategory} disabled={!categoryName.trim()}>
                Add Category
              </Button>
            </View>
          </View>
        )}
      </Card>

      {/* Danger Zone */}
      <Text category="s1" style={styles.sectionTitle}>
        Advanced
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <Button
          appearance="ghost"
          status="basic"
          accessoryLeft={(props) => <Icon {...props} name="refresh-outline" />}
          onPress={handleResetOnboarding}
          style={styles.dangerButton}
        >
          Reset Onboarding
        </Button>
      </Card>

      {/* Version */}
      <View style={styles.versionContainer}>
        <Text category="c1" style={{ color: colors.textMuted }}>
          Alpha Planner v1.0.0
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.lg,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  divider: {
    marginVertical: Spacing.sm,
  },
  slider: {
    width: '100%',
    height: 36,
    marginTop: Spacing.xs,
  },
  sliderRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },
  categoryName: {
    flex: 1,
  },
  categoryDelete: {
    width: 18,
    height: 18,
  },
  categoryForm: {
    marginTop: Spacing.sm,
  },
  colorPicker: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  dangerButton: {
    justifyContent: 'flex-start',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
});
