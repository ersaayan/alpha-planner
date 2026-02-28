import { Icon } from "@/components/icon";
import { CircularProgress } from "@/components/pomodoro";
import { Text } from "@ui-kitten/components";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Alert,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedButton } from "@/components/animated/animated-button";
import { AnimatedCard } from "@/components/animated/animated-card";
import { SpringConfig } from "@/constants/animations";
import {
  BorderRadius,
  Colors,
  FontSize,
  GamificationColors,
  InterFonts,
  Spacing
} from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { notificationService } from "@/services/notifications";
import { usePomodoroStore, useSettingsStore, useTodoStore } from "@/stores";

export default function PomodoroScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  // Select primitive values individually
  const remainingTime = usePomodoroStore((state) => state.timer.remainingTime);
  const timerState = usePomodoroStore((state) => state.timer.state);
  const timerPhase = usePomodoroStore((state) => state.timer.phase);
  const linkedTodoId = usePomodoroStore((state) => state.timer.linkedTodoId);
  const sessionsCompleted = usePomodoroStore(
    (state) => state.timer.sessionsCompleted,
  );

  // Get the linked todo from the todo store
  const linkedTodo = useTodoStore((state) =>
    linkedTodoId ? state.todos.find((todo) => todo.id === linkedTodoId) : null
  );

  const startTimer = usePomodoroStore((state) => state.startTimer);
  const pauseTimer = usePomodoroStore((state) => state.pauseTimer);
  const resumeTimer = usePomodoroStore((state) => state.resumeTimer);
  const stopTimer = usePomodoroStore((state) => state.stopTimer);
  const getProgress = usePomodoroStore((state) => state.getProgress);
  const skipToNextPhase = usePomodoroStore((state) => state.skipToNextPhase);
  const linkTodo = usePomodoroStore((state) => state.linkTodo);
  const pomodoroSettings = useSettingsStore((state) => state.pomodoroSettings);
  const { width } = useWindowDimensions();

  // Animation values
  const sessionDotScale = useSharedValue(1);

  // Format time display
  const formatTime = () => {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Keep screen awake while timer is running
  useEffect(() => {
    const shouldKeepAwake =
      pomodoroSettings.keepScreenAwake && timerState === "running";

    if (shouldKeepAwake) {
      activateKeepAwakeAsync("pomodoro-timer");
    } else {
      deactivateKeepAwake("pomodoro-timer");
    }

    return () => {
      deactivateKeepAwake("pomodoro-timer");
    };
  }, [pomodoroSettings.keepScreenAwake, timerState]);

  // Track previous remaining time to detect completion
  const prevRemainingTimeRef = useRef(remainingTime);
  useEffect(() => {
    if (
      prevRemainingTimeRef.current > 0 &&
      remainingTime === 0 &&
      timerState === "running"
    ) {
      const phaseLabel =
        timerPhase === "focus"
          ? "Focus session"
          : timerPhase === "short_break"
            ? "Short break"
            : "Long break";
      AccessibilityInfo.announceForAccessibility(
        `${phaseLabel} complete. Timer finished.`,
      );

      // Animate session dot
      sessionDotScale.value = withSequence(
        withSpring(1.3, SpringConfig.bouncy),
        withSpring(1, SpringConfig.default),
      );
    }
    prevRemainingTimeRef.current = remainingTime;
  }, [remainingTime, timerState, timerPhase]);

  const getPhaseColor = () => {
    switch (timerPhase) {
      case "focus":
        return colors.timerFocus;
      case "short_break":
      case "long_break":
        return colors.timerBreak;
      default:
        return colors.timerIdle;
    }
  };

  const getPhaseSecondaryColor = () => {
    switch (timerPhase) {
      case "focus":
        return GamificationColors.progressEnd;
      case "short_break":
      case "long_break":
        return colors.secondary;
      default:
        return colors.textMuted;
    }
  };

  const getPhaseLabel = () => {
    switch (timerPhase) {
      case "focus":
        return "Focus Time";
      case "short_break":
        return "Short Break";
      case "long_break":
        return "Long Break";
      default:
        return "Ready to Focus";
    }
  };

  const getPhaseIcon = () => {
    switch (timerPhase) {
      case "focus":
        return "bulb";
      case "short_break":
      case "long_break":
        return "coffee";
      default:
        return "clock";
    }
  };

  const handleStart = () => {
    startTimer();
  };

  const handlePauseResume = () => {
    if (timerState === "running") {
      pauseTimer();
    } else {
      resumeTimer();
    }
  };

  const handleStop = () => {
    if (timerState === 'running' || timerState === 'paused') {
      Alert.alert(
        'Stop Timer?',
        'Your current progress for this session will be lost.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Stop',
            style: 'destructive',
            onPress: () => {
              stopTimer();
              notificationService.dismissTimerNotification();
            },
          },
        ]
      );
    } else {
      stopTimer();
      notificationService.dismissTimerNotification();
    }
  };

  const handleSkip = () => {
    skipToNextPhase();
  };

  const sessionDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sessionDotScale.value }],
  }));

  // Calculate tab bar height for proper spacing
  const tabBarHeight = Math.max(insets.bottom, 20) + 80;
  const circleSize = Math.max(220, Math.min(width - Spacing.xl * 2, 320));
  const strokeWidth = 14;
  const cycleSessionIndex =
    sessionsCompleted % Math.max(1, pomodoroSettings.sessionsUntilLongBreak);

  const handleUnlink = () => {
    linkTodo(null);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: tabBarHeight,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Focus Timer
        </Text>
        <View
          style={[
            styles.sessionBadge,
            { backgroundColor: colors.primary + "20" },
          ]}
        >
          <Icon name="flag" fill={colors.primary} style={styles.sessionIcon} />
          <Text style={[styles.sessionText, { color: colors.primary }]}>
            Session {cycleSessionIndex + 1}
          </Text>
        </View>
      </View>

      {/* Timer Circle */}
      <View style={styles.timerContainer}>
        <CircularProgress
          size={circleSize}
          strokeWidth={strokeWidth}
          progress={getProgress()}
          progressColor={getPhaseColor()}
          secondaryColor={getPhaseSecondaryColor()}
          backgroundColor={colors.border}
          showGlow={timerState === "running"}
          isRunning={timerState === "running"}
        >
          <View style={styles.timerContent}>
            {/* Phase badge */}
            <View
              style={[
                styles.phaseBadge,
                { backgroundColor: getPhaseColor() + "20" },
              ]}
            >
              <Icon
                name={getPhaseIcon()}
                fill={getPhaseColor()}
                style={styles.phaseIcon}
              />
              <Text style={[styles.phaseLabel, { color: getPhaseColor() }]}>
                {getPhaseLabel()}
              </Text>
            </View>

            {/* Time display */}
            <Text style={[styles.timeText, { color: colors.text }]}>
              {formatTime()}
            </Text>

            {/* Time's up message */}
            {remainingTime === 0 && timerState === "running" && (
              <View
                style={[
                  styles.timesUpBadge,
                  { backgroundColor: colors.warning + "20" },
                ]}
              >
                <Icon
                  name="bell"
                  fill={colors.warning}
                  style={styles.timesUpIcon}
                />
                <Text style={[styles.timesUpText, { color: colors.warning }]}>
                  Time&apos;s up!
                </Text>
              </View>
            )}
          </View>
        </CircularProgress>
      </View>

      {/* Session dots */}
      <View style={styles.sessionDots}>
        {Array.from({ length: pomodoroSettings.sessionsUntilLongBreak }).map(
          (_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.sessionDot,
                i === cycleSessionIndex && sessionDotStyle,
                {
                  backgroundColor:
                    i < cycleSessionIndex ? colors.primary : colors.border,
                  borderColor:
                    i === cycleSessionIndex ? colors.primary : "transparent",
                  borderWidth: i === cycleSessionIndex ? 2 : 0,
                },
              ]}
            >
              {i < cycleSessionIndex && (
                <Icon name="checkmark" fill="#fff" style={styles.dotCheck} />
              )}
            </Animated.View>
          ),
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {timerState === "stopped" ? (
          <AnimatedButton
            title={
              timerPhase === "short_break" || timerPhase === "long_break"
                ? "Start Break"
                : "Start Focus"
            }
            icon="play"
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleStart}
          />
        ) : (
          <View style={styles.activeControls}>
            <AnimatedButton
              title="Stop"
              icon="stop-circle"
              variant="danger"
              size="md"
              style={styles.controlButton}
              onPress={handleStop}
            />
            <AnimatedButton
              title={timerState === "running" ? "Pause" : "Resume"}
              icon={timerState === "running" ? "pause" : "play"}
              variant="primary"
              size="md"
              style={styles.controlButton}
              onPress={handlePauseResume}
            />
          </View>
        )}
      </View>

      {/* Skip button */}
      {timerState !== "stopped" && (
        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>
            Skip to {timerPhase === "focus" ? "Break" : "Focus"}
          </Text>
          <Icon
            name="skip-forward"
            fill={colors.textSecondary}
            style={styles.skipIcon}
          />
        </Pressable>
      )}

      {/* Linked Todo Card */}
      {linkedTodoId && (
        <AnimatedCard
          variant="outlined"
          style={styles.linkedCard}
          contentStyle={styles.linkedContent}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.linkedIconContainer,
              { backgroundColor: colors.primary + "20" },
            ]}
          >
            <Icon
              name="link-2"
              fill={colors.primary}
              style={styles.linkedIcon}
            />
          </View>
          <View style={styles.linkedTextContainer}>
            <Text style={[styles.linkedLabel, { color: colors.textMuted }]}>
              Currently working on
            </Text>
            <Text
              style={[
                styles.linkedTitle,
                { color: linkedTodo ? colors.text : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {linkedTodo?.title ?? "Linked task not found"}
            </Text>
          </View>
          <Pressable
            style={[
              styles.unlinkButton,
              { backgroundColor: colors.backgroundSecondary },
            ]}
            onPress={handleUnlink}
            accessibilityRole="button"
            accessibilityLabel="Unlink task"
          >
            <Icon name="close" fill={colors.textMuted} style={styles.unlinkIcon} />
            <Text style={[styles.unlinkText, { color: colors.textMuted }]}>Unlink</Text>
          </Pressable>
        </AnimatedCard>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  headerTitle: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.xxl,
  },
  sessionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  sessionIcon: {
    width: 14,
    height: 14,
    marginRight: 6,
  },
  sessionText: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.sm,
  },
  timerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  timerContent: {
    alignItems: "center",
  },
  phaseBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  phaseIcon: {
    width: 14,
    height: 14,
    marginRight: 6,
  },
  phaseLabel: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xs,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  timeText: {
    fontFamily: InterFonts.light,
    fontSize: 72,
    letterSpacing: -2,
  },
  timesUpBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  timesUpIcon: {
    width: 14,
    height: 14,
    marginRight: 6,
  },
  timesUpText: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
  },
  sessionDots: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  sessionDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dotCheck: {
    width: 12,
    height: 12,
  },
  controls: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    width: "100%",
  },
  activeControls: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  controlButton: {
    flex: 1,
  },
  skipButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  skipText: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
  },
  skipIcon: {
    width: 16,
    height: 16,
    marginLeft: 6,
  },
  linkedCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    alignSelf: "stretch",
  },
  linkedContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  linkedIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  linkedIcon: {
    width: 20,
    height: 20,
  },
  linkedTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  linkedLabel: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
  },
  linkedTitle: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.md,
    marginTop: 2,
  },
  unlinkButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
  },
  unlinkIcon: {
    width: 14,
    height: 14,
    marginRight: 4,
  },
  unlinkText: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.xs,
  },
});
