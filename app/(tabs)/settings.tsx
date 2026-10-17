import { Icon } from '@/components/icon';
import { AccountSection } from '@/components/settings/account-section';
import { DataSection } from '@/components/settings/data-section';
import { categoryName as displayCategoryName } from '@/services/gamification/display';
import { ColorSwatches, CATEGORY_COLORS } from '@/components/common/color-swatches';
import { OptionPills, SettingSlider, SettingToggle } from '@/components/settings/setting-controls';
import { Button, Card, Divider, Input, Text } from '@ui-kitten/components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useAuthStore, useCategoryStore, useSettingsStore } from '@/stores';
import { changeLanguage } from '@/services/i18n/i18n-config';
import { updateProfile } from '@/services/supabase/auth-service';
import { isSyncConfigured } from '@/services/supabase/client';
import { useRouter } from 'expo-router';
import { getAppVersion } from '@/utils/app-version';

const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const isSignedIn = useAuthStore((state) => state.status === 'signedIn');

  const settings = useSettingsStore((state) => state.settings);
  const pomodoroSettings = useSettingsStore((state) => state.pomodoroSettings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const updatePomodoroSettings = useSettingsStore((state) => state.updatePomodoroSettings);
  const categories = useCategoryStore((state) => state.categories);
  const addCategory = useCategoryStore((state) => state.addCategory);
  const deleteCategory = useCategoryStore((state) => state.deleteCategory);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState<string>(CATEGORY_COLORS[0].value);

  const appVersion = getAppVersion();

  const formatDuration = (seconds: number) => {
    return t('settings.minutes', { value: Math.floor(seconds / 60) });
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
    // Keyboard-aware: the new-category name field stays above the keyboard.
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
      bottomOffset={Spacing.lg}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingBottom: bottomInset,
      }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text category="h5" accessibilityRole="header">{t('settings.title')}</Text>
      </View>

      {/* Pomodoro Settings */}
      <Text category="s1" style={styles.sectionTitle} accessibilityRole="header">
        {t('settings.pomodoroTimer')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <SettingSlider
          title={t('settings.focusDuration')}
          description={t('settings.focusDurationDesc')}
          valueText={formatDuration(pomodoroSettings.focusDuration)}
          value={focusMinutes}
          min={15}
          max={60}
          step={5}
          minLabel={t('settings.minutes', { value: 15 })}
          maxLabel={t('settings.minutes', { value: 60 })}
          color={colors.primary}
          onComplete={(value) => updatePomodoroSettings({ focusDuration: Math.round(value) * 60 })}
        />

        <Divider style={styles.divider} />

        <SettingSlider
          title={t('settings.shortBreak')}
          description={t('settings.shortBreakDesc')}
          valueText={formatDuration(pomodoroSettings.shortBreakDuration)}
          value={shortBreakMinutes}
          min={3}
          max={15}
          step={1}
          minLabel={t('settings.minutes', { value: 3 })}
          maxLabel={t('settings.minutes', { value: 15 })}
          color={colors.secondary}
          onComplete={(value) => updatePomodoroSettings({ shortBreakDuration: Math.round(value) * 60 })}
        />

        <Divider style={styles.divider} />

        <SettingSlider
          title={t('settings.longBreak')}
          description={t('settings.longBreakDesc', { count: pomodoroSettings.sessionsUntilLongBreak })}
          valueText={formatDuration(pomodoroSettings.longBreakDuration)}
          value={longBreakMinutes}
          min={10}
          max={30}
          step={5}
          minLabel={t('settings.minutes', { value: 10 })}
          maxLabel={t('settings.minutes', { value: 30 })}
          color={colors.accent}
          onComplete={(value) => updatePomodoroSettings({ longBreakDuration: Math.round(value) * 60 })}
        />

        <Divider style={styles.divider} />

        <SettingSlider
          title={t('settings.sessionsUntilLongBreak')}
          valueText={String(pomodoroSettings.sessionsUntilLongBreak)}
          value={pomodoroSettings.sessionsUntilLongBreak}
          min={2}
          max={6}
          step={1}
          minLabel="2"
          maxLabel="6"
          color={colors.primary}
          onComplete={(value) => updatePomodoroSettings({ sessionsUntilLongBreak: Math.round(value) })}
        />
      </Card>

      {/* Timer Behavior */}
      <Text category="s1" style={styles.sectionTitle} accessibilityRole="header">
        {t('settings.timerBehavior')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <SettingToggle
          title={t('settings.autoStartBreaks')}
          description={t('settings.autoStartBreaksDesc')}
          checked={pomodoroSettings.autoStartBreaks}
          onChange={(checked) => updatePomodoroSettings({ autoStartBreaks: checked })}
        />
        <Divider style={styles.divider} />
        <SettingToggle
          title={t('settings.autoStartFocus')}
          description={t('settings.autoStartFocusDesc')}
          checked={pomodoroSettings.autoStartFocus}
          onChange={(checked) => updatePomodoroSettings({ autoStartFocus: checked })}
        />
        <Divider style={styles.divider} />
        <SettingToggle
          title={t('settings.keepScreenAwake')}
          description={t('settings.keepScreenAwakeDesc')}
          checked={pomodoroSettings.keepScreenAwake}
          onChange={(checked) => updatePomodoroSettings({ keepScreenAwake: checked })}
        />
      </Card>

      {/* Notifications */}
      <Text category="s1" style={styles.sectionTitle} accessibilityRole="header">
        {t('settings.notifications')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <SettingToggle
          title={t('settings.enableNotifications')}
          description={t('settings.enableNotificationsDesc')}
          checked={settings.notificationsEnabled}
          onChange={(checked) => updateSettings({ notificationsEnabled: checked })}
        />
        <Divider style={styles.divider} />
        <SettingToggle
          title={t('settings.sound')}
          description={t('settings.soundDesc')}
          checked={settings.soundEnabled}
          onChange={(checked) => updateSettings({ soundEnabled: checked })}
        />
        <Divider style={styles.divider} />
        <SettingToggle
          title={t('settings.vibration')}
          description={t('settings.vibrationDesc')}
          checked={pomodoroSettings.vibrationEnabled}
          onChange={(checked) => updatePomodoroSettings({ vibrationEnabled: checked })}
        />

        <Divider style={styles.divider} />

        <Pressable
          style={styles.settingItem}
          onPress={() => router.push('/settings/notification-reliability')}
          accessibilityRole="button"
        >
          <View style={styles.settingInfo}>
            <Text category="s1">{t('settings.notificationReliability')}</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              {t('settings.notificationReliabilityDesc')}
            </Text>
          </View>
          <Icon name="chevron-right" fill={colors.textMuted} style={styles.chevron} />
        </Pressable>
      </Card>

      {/* App Settings */}
      <Text category="s1" style={styles.sectionTitle} accessibilityRole="header">
        {t('settings.app')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <SettingToggle
          title={t('settings.hapticFeedback')}
          description={t('settings.hapticFeedbackDesc')}
          checked={settings.hapticFeedbackEnabled}
          onChange={(checked) => updateSettings({ hapticFeedbackEnabled: checked })}
        />
      </Card>

      {/* Appearance */}
      <Text category="s1" style={styles.sectionTitle} accessibilityRole="header">
        {t('settings.appearance')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <OptionPills
          label={t('settings.theme')}
          options={[
            { value: 'system', label: t('settings.system') },
            { value: 'light', label: t('settings.light') },
            { value: 'dark', label: t('settings.dark') },
          ]}
          selected={settings.theme}
          onSelect={(theme) => updateSettings({ theme })}
        />
      </Card>

      {/* Preferences */}
      <Text category="s1" style={styles.sectionTitle} accessibilityRole="header">
        {t('settings.preferences')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <OptionPills
          label={t('settings.dateFormat')}
          options={DATE_FORMATS.map((format) => ({ value: format, label: format }))}
          selected={settings.dateFormat}
          onSelect={(dateFormat) => updateSettings({ dateFormat })}
        />

        <Divider style={styles.divider} />

        <OptionPills
          label={t('settings.timeFormat')}
          options={[
            { value: '12h', label: t('settings.timeFormat12') },
            { value: '24h', label: t('settings.timeFormat24') },
          ]}
          selected={settings.timeFormat}
          onSelect={(timeFormat) => updateSettings({ timeFormat })}
        />

        <Divider style={styles.divider} />

        <OptionPills<'auto' | 0 | 1>
          label={t('settings.weekStartsOn')}
          options={[
            { value: 'auto', label: t('settings.weekStartsAuto') },
            { value: 1, label: t('settings.monday') },
            { value: 0, label: t('settings.sunday') },
          ]}
          selected={settings.weekStartsOn}
          onSelect={(weekStartsOn) => updateSettings({ weekStartsOn })}
        />

      </Card>

      {/* Categories */}
      <Text category="s1" style={styles.sectionTitle} accessibilityRole="header">
        {t('settings.categories')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        {categories.map((category) => (
          <View key={category.id} style={styles.categoryRow}>
            <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
            <Text category="s1" style={styles.categoryName}>
              {displayCategoryName(t, category)}
            </Text>
            {!category.isDefault && (
              <Pressable
                onPress={() => handleDeleteCategory(category.id)}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel={t('settings.deleteCategoryNamed', { name: displayCategoryName(t, category) })}
              >
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
              label={t('settings.categoryName')}
              placeholder={t('settings.categoryPlaceholder')}
              value={categoryName}
              onChangeText={setCategoryName}
              style={{ marginBottom: Spacing.md }}
            />
            <Text category="c1" style={{ marginBottom: Spacing.sm }}>
              {t('settings.chooseColor')}
            </Text>
            <ColorSwatches value={categoryColor} onChange={setCategoryColor} label={t('settings.chooseColor')} />
            <View style={styles.formButtons}>
              <Button appearance="ghost" size="small" onPress={() => setShowCategoryForm(false)}>
                {t('common.cancel')}
              </Button>
              <Button size="small" onPress={handleAddCategory} disabled={!categoryName.trim()}>
                {t('settings.addCategory')}
              </Button>
            </View>
          </View>
        )}
      </Card>

      {/* Language */}
      <Text category="s1" style={styles.sectionTitle} accessibilityRole="header">
        {t('settings.language')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.language')}>
          {(['system', 'tr', 'en'] as const).map((lang) => {
            const labels = { system: t('settings.system'), tr: t('settings.languageTr'), en: t('settings.languageEn') };
            const isSelected = settings.language === lang;
            return (
              <Pressable
                key={lang}
                style={styles.settingItem}
                onPress={() => {
                  updateSettings({ language: lang });
                  changeLanguage(lang);
                  // Sync language preference to the profile (builds with sync, signed in)
                  if (isSyncConfigured && isSignedIn) {
                    updateProfile({ locale: lang }).catch(() => {});
                  }
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
              >
                <Text category="s2" style={{ color: isSelected ? colors.text : colors.textSecondary, flex: 1 }}>
                  {labels[lang]}
                </Text>
                {isSelected && (
                  <Icon name="checkmark-outline" fill={colors.primary} size={20} />
                )}
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Account (only in builds with sync configured) */}
      <AccountSection />

      {/* Data: export / import (the only backup of a local-first app) */}
      <DataSection />

      {/* Danger Zone */}
      <Text category="s1" style={styles.sectionTitle}>
        {t('settings.advanced')}
      </Text>
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <Button
          appearance="ghost"
          status="basic"
          accessoryLeft={(props) => <Icon {...props} name="refresh-outline" />}
          onPress={handleResetOnboarding}
          style={styles.dangerButton}
        >
          {t('settings.resetOnboarding')}
        </Button>

        <Divider style={styles.divider} />

        <Button
          appearance="ghost"
          status="danger"
          accessoryLeft={(props) => <Icon {...props} name="trash-2-outline" />}
          onPress={handleResetAllData}
          style={styles.dangerButton}
        >
          {t('settings.resetAllData')}
        </Button>
      </Card>

      {/* Version */}
      <View style={styles.versionContainer}>
        <Text category="c1" style={{ color: colors.textMuted }}>
          {appVersion.build
            ? t('settings.versionWithBuild', appVersion)
            : t('settings.version', { version: appVersion.version })}
        </Text>
      </View>
    </KeyboardAwareScrollView>
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
    minHeight: 44,
    paddingVertical: Spacing.xs,
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  divider: {
    marginVertical: Spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
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
    width: 20,
    height: 20,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 20,
    height: 20,
  },
  categoryForm: {
    marginTop: Spacing.sm,
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
