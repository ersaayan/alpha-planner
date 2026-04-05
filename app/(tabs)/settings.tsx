import { Icon } from '@/components/icon';
import Slider from '@react-native-community/slider';
import { Button, Card, Divider, Input, Text, Toggle } from '@ui-kitten/components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore, useCategoryStore, useSettingsStore } from '@/stores';
import { changeLanguage } from '@/services/i18n/i18n-config';
import { updateProfile } from '@/services/supabase/auth-service';
import { useRouter } from 'expo-router';

const EXTRA_COLORS = ['#E57373', '#81C784', '#64B5F6', '#FFB74D', '#BA68C8', '#4DB6AC'];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const profile = useAuthStore((state) => state.profile);
  const signOut = useAuthStore((state) => state.signOut);

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
      t('settings.resetOnboardingTitle'),
      t('settings.resetOnboardingMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.reset'),
          style: 'destructive',
          onPress: () => updateSettings({ hasCompletedOnboarding: false }),
        },
      ]
    );
  };

  const resetAllData = useSettingsStore((state) => state.resetAllData);

  const handleResetAllData = () => {
    Alert.alert(
      t('settings.resetAllDataTitle'),
      t('settings.resetAllDataMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteEverything'),
          style: 'destructive',
          onPress: async () => {
            try {
              await resetAllData();
              Alert.alert(t('settings.resetDone'), t('settings.resetDoneMsg'));
            } catch {
              Alert.alert(t('common.error'), t('settings.resetFailed'));
            }
          },
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
    Alert.alert(t('settings.deleteCategory'), t('settings.deleteCategoryConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
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
        <Text category="h5">{t('settings.title')}</Text>
      </View>

      {/* Pomodoro Settings */}
      <Text category="s1" style={styles.sectionTitle}>
        {t('settings.pomodoroTimer')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">{t('settings.focusDuration')}</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              {t('settings.focusDurationDesc')}
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
          onSlidingComplete={(value) => updatePomodoroSettings({ focusDuration: Math.round(value) * 60 })}
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
            <Text category="s1">{t('settings.shortBreak')}</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              {t('settings.shortBreakDesc')}
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
          onSlidingComplete={(value) => updatePomodoroSettings({ shortBreakDuration: Math.round(value) * 60 })}
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
            <Text category="s1">{t('settings.longBreak')}</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              {t('settings.longBreakDesc', { count: pomodoroSettings.sessionsUntilLongBreak })}
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
          onSlidingComplete={(value) => updatePomodoroSettings({ longBreakDuration: Math.round(value) * 60 })}
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
            <Text category="s1">{t('settings.sessionsUntilLongBreak')}</Text>
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
          onSlidingComplete={(value) => updatePomodoroSettings({ sessionsUntilLongBreak: Math.round(value) })}
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
        {t('settings.timerBehavior')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">{t('settings.autoStartBreaks')}</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              {t('settings.autoStartBreaksDesc')}
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
            <Text category="s1">{t('settings.autoStartFocus')}</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              {t('settings.autoStartFocusDesc')}
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
            <Text category="s1">{t('settings.keepScreenAwake')}</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              {t('settings.keepScreenAwakeDesc')}
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
        {t('settings.notifications')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">{t('settings.enableNotifications')}</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              {t('settings.enableNotificationsDesc')}
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
            <Text category="s1">{t('settings.sound')}</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              {t('settings.soundDesc')}
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
            <Text category="s1">{t('settings.vibration')}</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              {t('settings.vibrationDesc')}
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
        {t('settings.app')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">{t('settings.hapticFeedback')}</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              {t('settings.hapticFeedbackDesc')}
            </Text>
          </View>
          <Toggle
            checked={settings.hapticFeedbackEnabled}
            onChange={(checked) => updateSettings({ hapticFeedbackEnabled: checked })}
          />
        </View>
      </Card>

      {/* Appearance */}
      <Text category="s1" style={styles.sectionTitle}>
        {t('settings.appearance')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">{t('settings.theme')}</Text>
          </View>
        </View>
        <View style={styles.pillGroup}>
          {(['system', 'light', 'dark'] as const).map((option) => (
            <Pressable
              key={option}
              style={[
                styles.pill,
                {
                  backgroundColor: settings.theme === option ? colors.primary + '20' : colors.backgroundSecondary,
                  borderColor: settings.theme === option ? colors.primary : 'transparent'
                },
              ]}
              onPress={() => updateSettings({ theme: option })}
            >
              <Text category="c1" style={{ color: settings.theme === option ? colors.primary : colors.text }}>
                {option === 'system' ? t('settings.system') : option === 'light' ? t('settings.light') : t('settings.dark')}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Preferences */}
      <Text category="s1" style={styles.sectionTitle}>
        {t('settings.preferences')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        {/* Date Format */}
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">{t('settings.dateFormat')}</Text>
          </View>
        </View>
        <View style={styles.pillGroup}>
          {(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const).map((fmt) => (
            <Pressable
              key={fmt}
              style={[
                styles.pill,
                {
                  backgroundColor: settings.dateFormat === fmt ? colors.primary + '20' : colors.backgroundSecondary,
                  borderColor: settings.dateFormat === fmt ? colors.primary : 'transparent'
                },
              ]}
              onPress={() => updateSettings({ dateFormat: fmt })}
            >
              <Text category="c1" style={{ color: settings.dateFormat === fmt ? colors.primary : colors.text }}>
                {fmt}
              </Text>
            </Pressable>
          ))}
        </View>

        <Divider style={styles.divider} />

        {/* Time Format */}
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">{t('settings.timeFormat')}</Text>
          </View>
        </View>
        <View style={styles.pillGroup}>
          {(['12h', '24h'] as const).map((fmt) => (
            <Pressable
              key={fmt}
              style={[
                styles.pill,
                {
                  backgroundColor: settings.timeFormat === fmt ? colors.primary + '20' : colors.backgroundSecondary,
                  borderColor: settings.timeFormat === fmt ? colors.primary : 'transparent'
                },
              ]}
              onPress={() => updateSettings({ timeFormat: fmt })}
            >
              <Text category="c1" style={{ color: settings.timeFormat === fmt ? colors.primary : colors.text }}>
                {fmt === '12h' ? t('settings.timeFormat12') : t('settings.timeFormat24')}
              </Text>
            </Pressable>
          ))}
        </View>

        <Divider style={styles.divider} />

        {/* Week Starts On */}
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">{t('settings.weekStartsOn')}</Text>
          </View>
        </View>
        <View style={styles.pillGroup}>
          {([0, 1] as const).map((day) => (
            <Pressable
              key={day}
              style={[
                styles.pill,
                {
                  backgroundColor: settings.weekStartsOn === day ? colors.primary + '20' : colors.backgroundSecondary,
                  borderColor: settings.weekStartsOn === day ? colors.primary : 'transparent'
                },
              ]}
              onPress={() => updateSettings({ weekStartsOn: day })}
            >
              <Text category="c1" style={{ color: settings.weekStartsOn === day ? colors.primary : colors.text }}>
                {day === 0 ? t('settings.sunday') : t('settings.monday')}
              </Text>
            </Pressable>
          ))}
        </View>

        <Divider style={styles.divider} />

        {/* Default View */}
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">{t('settings.defaultTaskView')}</Text>
          </View>
        </View>
        <View style={styles.pillGroup}>
          {(['list', 'kanban', 'calendar', 'timeline'] as const).map((view) => (
            <Pressable
              key={view}
              style={[
                styles.pill,
                {
                  backgroundColor: settings.defaultView === view ? colors.primary + '20' : colors.backgroundSecondary,
                  borderColor: settings.defaultView === view ? colors.primary : 'transparent'
                },
              ]}
              onPress={() => updateSettings({ defaultView: view })}
            >
              <Text category="c1" style={{ color: settings.defaultView === view ? colors.primary : colors.text }}>
                {t(`settings.view${view.charAt(0).toUpperCase() + view.slice(1)}` as any)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Categories */}
      <Text category="s1" style={styles.sectionTitle}>
        {t('settings.categories')}
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
            {t('settings.addCategory')}
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

      {/* Language */}
      <Text category="s1" style={styles.sectionTitle}>
        Language
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        {(['system', 'tr', 'en'] as const).map((lang) => {
          const labels = { system: 'System', tr: 'Türkçe', en: 'English' };
          const isSelected = settings.language === lang;
          return (
            <Pressable
              key={lang}
              style={[styles.settingItem, { opacity: isSelected ? 1 : 0.6 }]}
              onPress={() => {
                updateSettings({ language: lang });
                changeLanguage(lang);
                // Sync language preference to profile
                const locale = lang === 'system' ? 'system' : lang;
                updateProfile({ locale }).catch(() => {});
              }}
            >
              <Text category="s2" style={{ color: colors.text, flex: 1 }}>
                {labels[lang]}
              </Text>
              {isSelected && (
                <Icon name="checkmark-outline" fill={colors.primary} size={20} />
              )}
            </Pressable>
          );
        })}
      </Card>

      {/* Account */}
      <Text category="s1" style={styles.sectionTitle}>
        Account
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.settingItem}>
          <View style={{ flex: 1 }}>
            <Text category="s2" style={{ color: colors.text }}>
              {profile?.displayName ?? 'User'}
            </Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              {profile?.locale === 'tr' ? 'Türkçe' : 'English'}
              {profile?.prestigeCount ? ` · Prestige ${profile.prestigeCount}` : ''}
            </Text>
          </View>
          <Icon name="person-outline" fill={colors.textMuted} size={24} />
        </View>

        <Divider style={styles.divider} />

        <Button
          appearance="ghost"
          status="danger"
          accessoryLeft={(props) => <Icon {...props} name="log-out-outline" />}
          onPress={() => {
            Alert.alert(
              'Sign Out',
              'Are you sure you want to sign out?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: async () => {
                    await signOut();
                    router.replace('/(auth)/login' as any);
                  },
                },
              ]
            );
          }}
          style={styles.dangerButton}
        >
          Sign Out
        </Button>
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

        <Divider style={styles.divider} />

        <Button
          appearance="ghost"
          status="danger"
          accessoryLeft={(props) => <Icon {...props} name="trash-2-outline" />}
          onPress={handleResetAllData}
          style={styles.dangerButton}
        >
          Reset All Data
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
  pillGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
