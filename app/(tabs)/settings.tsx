import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { Text, Card, Toggle, Button, Divider } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettingsStore } from '@/stores';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const settings = useSettingsStore((state) => state.settings);
  const pomodoroSettings = useSettingsStore((state) => state.pomodoroSettings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const updatePomodoroSettings = useSettingsStore((state) => state.updatePomodoroSettings);

  const formatDuration = (seconds: number) => {
    return `${Math.floor(seconds / 60)} min`;
  };

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

        <Divider style={styles.divider} />

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text category="s1">Sessions Until Long Break</Text>
          </View>
          <Text category="s1" style={{ color: colors.primary }}>
            {pomodoroSettings.sessionsUntilLongBreak}
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
  dangerButton: {
    justifyContent: 'flex-start',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
});
