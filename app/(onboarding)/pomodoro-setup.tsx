import { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Button, Card } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';

import { useSettingsStore } from '@/stores';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function PomodoroSetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const updatePomodoroSettings = useSettingsStore((state) => state.updatePomodoroSettings);

  const [focusDuration, setFocusDuration] = useState(25);
  const [shortBreak, setShortBreak] = useState(5);
  const [longBreak, setLongBreak] = useState(15);
  const [sessionsUntilLongBreak, setSessionsUntilLongBreak] = useState(4);

  const handleContinue = () => {
    updatePomodoroSettings({
      focusDuration: focusDuration * 60,
      shortBreakDuration: shortBreak * 60,
      longBreakDuration: longBreak * 60,
      sessionsUntilLongBreak,
    });
    router.push('/(onboarding)/category-selection');
  };

  const handleUseDefaults = () => {
    setFocusDuration(25);
    setShortBreak(5);
    setLongBreak(15);
    setSessionsUntilLongBreak(4);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.lg,
        },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text category="h4">Set Your Timer</Text>
          <Text category="s1" style={{ color: colors.textSecondary }}>
            Customize your Pomodoro intervals
          </Text>
        </View>

        {/* Focus Duration */}
        <Card style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.sliderHeader}>
            <View style={styles.sliderLabel}>
              <Icon name="clock-outline" fill={colors.primary} style={styles.labelIcon} />
              <Text category="s1">Focus Duration</Text>
            </View>
            <Text category="h6" style={{ color: colors.primary }}>
              {focusDuration} min
            </Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={15}
            maximumValue={60}
            step={5}
            value={focusDuration}
            onValueChange={setFocusDuration}
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
        </Card>

        {/* Short Break */}
        <Card style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.sliderHeader}>
            <View style={styles.sliderLabel}>
              <Icon name="coffee-outline" fill={colors.secondary} style={styles.labelIcon} />
              <Text category="s1">Short Break</Text>
            </View>
            <Text category="h6" style={{ color: colors.secondary }}>
              {shortBreak} min
            </Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={3}
            maximumValue={15}
            step={1}
            value={shortBreak}
            onValueChange={setShortBreak}
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
        </Card>

        {/* Long Break */}
        <Card style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.sliderHeader}>
            <View style={styles.sliderLabel}>
              <Icon name="sun-outline" fill={colors.accent} style={styles.labelIcon} />
              <Text category="s1">Long Break</Text>
            </View>
            <Text category="h6" style={{ color: colors.accent }}>
              {longBreak} min
            </Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={10}
            maximumValue={30}
            step={5}
            value={longBreak}
            onValueChange={setLongBreak}
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
        </Card>

        {/* Sessions Count */}
        <Card style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.sliderHeader}>
            <View style={styles.sliderLabel}>
              <Icon name="repeat-outline" fill={colors.primary} style={styles.labelIcon} />
              <Text category="s1">Sessions Until Long Break</Text>
            </View>
            <Text category="h6" style={{ color: colors.primary }}>
              {sessionsUntilLongBreak}
            </Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={2}
            maximumValue={6}
            step={1}
            value={sessionsUntilLongBreak}
            onValueChange={setSessionsUntilLongBreak}
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

        {/* Preview */}
        <Card style={[styles.previewCard, { backgroundColor: colors.backgroundSecondary }]}>
          <Text category="s2" style={{ color: colors.textSecondary, marginBottom: Spacing.sm }}>
            Your Cycle Preview
          </Text>
          <View style={styles.previewRow}>
            {Array.from({ length: sessionsUntilLongBreak }).map((_, i) => (
              <View key={i} style={styles.previewItem}>
                <View style={[styles.previewDot, { backgroundColor: colors.primary }]} />
                <Text category="c2">{focusDuration}m</Text>
                {i < sessionsUntilLongBreak - 1 && (
                  <>
                    <View style={[styles.previewDot, { backgroundColor: colors.secondary }]} />
                    <Text category="c2">{shortBreak}m</Text>
                  </>
                )}
              </View>
            ))}
            <View style={styles.previewItem}>
              <View style={[styles.previewDot, { backgroundColor: colors.accent }]} />
              <Text category="c2">{longBreak}m</Text>
            </View>
          </View>
        </Card>

        {/* Use Defaults */}
        <Button appearance="ghost" size="small" onPress={handleUseDefaults}>
          Use Classic 25/5/15
        </Button>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <Button
          appearance="ghost"
          onPress={() => router.back()}
          accessoryLeft={(props) => <Icon {...props} name="arrow-back-outline" />}
        >
          Back
        </Button>
        <Button style={styles.continueButton} onPress={handleContinue}>
          Continue
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  card: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sliderLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  labelIcon: {
    width: 20,
    height: 20,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewCard: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bottomButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
  },
  continueButton: {
    minWidth: 120,
    borderRadius: BorderRadius.lg,
  },
});
