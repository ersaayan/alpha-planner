/**
 * DailySummaryModal - End-of-day summary modal with animated stats
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { Text } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { AnimatedCounter } from '@/components/animated/animated-counter';
import { AnimatedProgressBar } from '@/components/animated/animated-progress-bar';
import { AnimatedButton } from '@/components/animated/animated-button';
import {
  BorderRadius,
  Colors,
  GamificationColors,
  Spacing,
  Shadows,
  InterFonts,
  FontSize,
  Typography,
} from '@/constants/theme';
import { AnimationDuration, SpringConfig } from '@/constants/animations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDuration } from '@/utils/theme-helpers';

interface DailySummaryModalProps {
  visible: boolean;
  onClose: () => void;
  data: {
    totalFocusTime: number;
    pomodorosCompleted: number;
    tasksCompleted: number;
    subtasksCompleted: number;
    topCategory: { name: string; time: number } | null;
    xpEarned: number;
    streakStatus: { days: number; isActive: boolean };
    comboMultiplier: number;
    dailyQuestsStatus: { completed: number; total: number };
    weeklyGoalProgress: { completed: number; total: number; percentage: number };
    deltaFromYesterday: { pomodoros: number; focusTime: number; tasks: number };
    motivationLevel: 'great' | 'normal' | 'low';
  };
  motivationalMessage: string;
}

export function DailySummaryModal({
  visible,
  onClose,
  data,
  motivationalMessage,
}: DailySummaryModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const backdropOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(40);
  const modalOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: AnimationDuration.medium });
      modalOpacity.value = withDelay(
        100,
        withTiming(1, { duration: AnimationDuration.medium })
      );
      modalTranslateY.value = withDelay(
        100,
        withSpring(0, SpringConfig.default)
      );
    } else {
      backdropOpacity.value = 0;
      modalOpacity.value = 0;
      modalTranslateY.value = 40;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Reanimated shared values are stable refs
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ translateY: modalTranslateY.value }],
  }));

  const handleClose = () => {
    backdropOpacity.set(withTiming(0, { duration: AnimationDuration.fast }));
    modalTranslateY.set(withTiming(40, { duration: AnimationDuration.fast }));
    modalOpacity.set(withTiming(0, { duration: AnimationDuration.fast }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    }));
  };

  // --- helpers ---

  const focusHours = Math.floor(data.totalFocusTime / 3600);
  const focusMinutes = Math.floor((data.totalFocusTime % 3600) / 60);

  const formatDelta = (value: number, suffix: string): { text: string; isPositive: boolean } => {
    const sign = value >= 0 ? '+' : '';
    return { text: `${sign}${value}${suffix}`, isPositive: value >= 0 };
  };

  const pomoDelta = formatDelta(data.deltaFromYesterday.pomodoros, ' pomodoro');
  const focusDelta = formatDelta(data.deltaFromYesterday.focusTime, 'dk');
  const tasksDelta = formatDelta(data.deltaFromYesterday.tasks, ' gorev');

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Modal content */}
        <Animated.View
          style={[
            styles.modal,
            { backgroundColor: colors.card },
            Shadows.xl,
            modalStyle,
          ]}
          accessibilityViewIsModal={true}
          accessibilityLabel="Gunun ozeti"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                Gunun Ozeti
              </Text>
              <Pressable
                onPress={handleClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
              >
                <Icon name="close" fill={colors.textMuted} size={24} />
              </Pressable>
            </View>

            {/* Stats grid (2 columns) */}
            <View style={styles.statsGrid}>
              {/* Focus time */}
              <View style={[styles.statCard, { backgroundColor: colors.backgroundSecondary }]}>
                <Icon name="clock" fill={colors.primary} size={20} />
                <AnimatedCounter
                  value={focusHours}
                  suffix={`h ${focusMinutes}m`}
                  formatNumber={(v) => `${v}`}
                  category="h3"
                  color={colors.text}
                  style={styles.statValue}
                />
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  Odaklanma
                </Text>
              </View>

              {/* Pomodoros */}
              <View style={[styles.statCard, { backgroundColor: colors.backgroundSecondary }]}>
                <Icon name="timer-outline" fill={colors.primary} size={20} />
                <AnimatedCounter
                  value={data.pomodorosCompleted}
                  category="h3"
                  color={colors.text}
                  style={styles.statValue}
                />
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  Pomodoro
                </Text>
              </View>

              {/* Tasks completed */}
              <View style={[styles.statCard, { backgroundColor: colors.backgroundSecondary }]}>
                <Icon name="checkmark-circle" fill={colors.success} size={20} />
                <AnimatedCounter
                  value={data.tasksCompleted}
                  category="h3"
                  color={colors.text}
                  style={styles.statValue}
                />
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  Gorev
                </Text>
              </View>

              {/* XP earned */}
              <View style={[styles.statCard, { backgroundColor: colors.backgroundSecondary }]}>
                <Icon name="star" fill={GamificationColors.xp} size={20} />
                <AnimatedCounter
                  value={data.xpEarned}
                  suffix=" XP"
                  category="h3"
                  color={GamificationColors.xp}
                  style={styles.statValue}
                />
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  Kazanilan
                </Text>
              </View>
            </View>

            {/* Streak status */}
            <View style={[styles.row, { backgroundColor: colors.backgroundSecondary }]}>
              <Icon
                name="fire"
                fill={data.streakStatus.isActive ? GamificationColors.streak : colors.textMuted}
                size={22}
              />
              <Text
                style={[
                  styles.rowText,
                  {
                    color: data.streakStatus.isActive
                      ? GamificationColors.streak
                      : colors.error,
                  },
                ]}
              >
                {data.streakStatus.isActive
                  ? `${data.streakStatus.days} gun`
                  : 'Kirildi!'}
              </Text>
              {data.streakStatus.isActive && (
                <Text style={[styles.rowSubtext, { color: colors.textMuted }]}>
                  seri
                </Text>
              )}
            </View>

            {/* Combo multiplier (only shown if > 1) */}
            {data.comboMultiplier > 1 && (
              <View style={[styles.comboBadge, { backgroundColor: GamificationColors.xp + '1A' }]}>
                <Icon name="flash" fill={GamificationColors.xp} size={18} />
                <Text style={[styles.comboText, { color: GamificationColors.xp }]}>
                  {data.comboMultiplier}x Combo
                </Text>
              </View>
            )}

            {/* Top category */}
            {data.topCategory && (
              <View style={[styles.row, { backgroundColor: colors.backgroundSecondary }]}>
                <View style={[styles.categoryDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.rowText, { color: colors.text, flex: 1 }]}>
                  {data.topCategory.name}
                </Text>
                <Text style={[styles.rowSubtext, { color: colors.textSecondary }]}>
                  {formatDuration(data.topCategory.time)}
                </Text>
              </View>
            )}

            {/* Daily quests progress */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: colors.text }]}>
                  Gunluk Gorevler
                </Text>
                <Text style={[styles.progressValue, { color: colors.textSecondary }]}>
                  {data.dailyQuestsStatus.completed}/{data.dailyQuestsStatus.total}
                </Text>
              </View>
              <AnimatedProgressBar
                progress={
                  data.dailyQuestsStatus.total > 0
                    ? data.dailyQuestsStatus.completed / data.dailyQuestsStatus.total
                    : 0
                }
                height={8}
                showShimmer={false}
                style={styles.progressBar}
              />
            </View>

            {/* Weekly goal progress */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: colors.text }]}>
                  Haftalik Hedef
                </Text>
                <Text style={[styles.progressValue, { color: colors.textSecondary }]}>
                  %{data.weeklyGoalProgress.percentage}
                </Text>
              </View>
              <AnimatedProgressBar
                progress={data.weeklyGoalProgress.percentage / 100}
                height={8}
                showShimmer={false}
                style={styles.progressBar}
              />
            </View>

            {/* Delta from yesterday */}
            <View style={styles.deltaContainer}>
              <Text style={[styles.deltaTitle, { color: colors.textMuted }]}>
                Dune gore
              </Text>
              <View style={styles.deltaChips}>
                <View
                  style={[
                    styles.deltaChip,
                    {
                      backgroundColor: pomoDelta.isPositive
                        ? colors.success + '1A'
                        : colors.error + '1A',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.deltaChipText,
                      { color: pomoDelta.isPositive ? colors.success : colors.error },
                    ]}
                  >
                    {pomoDelta.text}
                  </Text>
                </View>
                <View
                  style={[
                    styles.deltaChip,
                    {
                      backgroundColor: focusDelta.isPositive
                        ? colors.success + '1A'
                        : colors.error + '1A',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.deltaChipText,
                      { color: focusDelta.isPositive ? colors.success : colors.error },
                    ]}
                  >
                    {focusDelta.text}
                  </Text>
                </View>
                <View
                  style={[
                    styles.deltaChip,
                    {
                      backgroundColor: tasksDelta.isPositive
                        ? colors.success + '1A'
                        : colors.error + '1A',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.deltaChipText,
                      { color: tasksDelta.isPositive ? colors.success : colors.error },
                    ]}
                  >
                    {tasksDelta.text}
                  </Text>
                </View>
              </View>
            </View>

            {/* Motivational message */}
            <Text style={[styles.motivationalMessage, { color: colors.textSecondary }]}>
              {motivationalMessage}
            </Text>

            {/* Close button */}
            <AnimatedButton
              title="Kapat"
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleClose}
              style={styles.closeButton}
            />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '85%',
    borderRadius: BorderRadius.xxl,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: Spacing.xl,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.xl,
  },
  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: FontSize.xl,
  },
  statLabel: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.xs,
  },
  // Shared row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  rowText: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.md,
  },
  rowSubtext: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
  },
  // Category dot
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: BorderRadius.full,
  },
  // Combo badge
  comboBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  comboText: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.sm,
  },
  // Progress sections
  progressSection: {
    marginBottom: Spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  progressLabel: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.sm,
  },
  progressValue: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
  },
  progressBar: {
    borderRadius: BorderRadius.xs,
  },
  // Delta chips
  deltaContainer: {
    marginBottom: Spacing.lg,
  },
  deltaTitle: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.xs,
    marginBottom: Spacing.sm,
  },
  deltaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  deltaChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  deltaChipText: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xs,
  },
  // Motivational message
  motivationalMessage: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.5,
    marginBottom: Spacing.lg,
  },
  // Close button
  closeButton: {
    marginTop: Spacing.xs,
  },
});

export default DailySummaryModal;
