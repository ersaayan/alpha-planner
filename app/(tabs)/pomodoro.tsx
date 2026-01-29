import { Button, Card, Text } from "@ui-kitten/components";
import { Icon } from "@/components/icon";
import { CircularProgress } from "@/components/pomodoro";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import { BorderRadius, Colors, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { notificationService } from "@/services/notifications";
import {
  useGamificationStore,
  usePomodoroStore,
  useSettingsStore,
  useTodoStore,
} from "@/stores";

export default function PomodoroScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  // Select primitive values individually to ensure React re-renders on changes
  // Selecting the entire timer object causes Zustand to miss updates
  const remainingTime = usePomodoroStore((state) => state.timer.remainingTime);
  const totalTime = usePomodoroStore((state) => state.timer.totalTime);
  const timerState = usePomodoroStore((state) => state.timer.state);
  const timerPhase = usePomodoroStore((state) => state.timer.phase);
  const linkedTodoId = usePomodoroStore((state) => state.timer.linkedTodoId);
  const sessionsCompleted = usePomodoroStore((state) => state.timer.sessionsCompleted);

  const startTimer = usePomodoroStore((state) => state.startTimer);
  const pauseTimer = usePomodoroStore((state) => state.pauseTimer);
  const resumeTimer = usePomodoroStore((state) => state.resumeTimer);
  const stopTimer = usePomodoroStore((state) => state.stopTimer);
  const getProgress = usePomodoroStore((state) => state.getProgress);

  // Calculate formatted time locally instead of using store function
  const formatTime = () => {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  const skipToNextPhase = usePomodoroStore((state) => state.skipToNextPhase);
  const completeSession = usePomodoroStore((state) => state.completeSession);
  const incrementPomodoroCount = useTodoStore(
    (state) => state.incrementPomodoroCount,
  );
  const incrementPomodoro = useGamificationStore(
    (state) => state.incrementPomodoro,
  );
  const pomodoroSettings = useSettingsStore((state) => state.pomodoroSettings);

  // Keep screen awake while timer is running (if enabled in settings)
  useEffect(() => {
    const shouldKeepAwake = pomodoroSettings.keepScreenAwake && timerState === 'running';

    if (shouldKeepAwake) {
      activateKeepAwakeAsync('pomodoro-timer');
    } else {
      deactivateKeepAwake('pomodoro-timer');
    }

    return () => {
      deactivateKeepAwake('pomodoro-timer');
    };
  }, [pomodoroSettings.keepScreenAwake, timerState]);

  // Handle timer completion (gamification, notifications, and auto-start)
  useEffect(() => {
    if (remainingTime === 0 && timerState === "running") {
      // Dismiss ongoing notification and send completion notification
      notificationService.dismissTimerNotification();
      notificationService.sendTimerCompleteNotification(timerPhase as 'focus' | 'short_break' | 'long_break');

      if (timerPhase === "focus") {
        completeSession();
        incrementPomodoro(pomodoroSettings.focusDuration);
        if (linkedTodoId) {
          incrementPomodoroCount(linkedTodoId);
        }
      }

      // Stop the timer
      stopTimer();

      // Handle auto-start for next phase
      const shouldAutoStartBreak = pomodoroSettings.autoStartBreaks && timerPhase === 'focus';
      const shouldAutoStartFocus = pomodoroSettings.autoStartFocus && (timerPhase === 'short_break' || timerPhase === 'long_break');

      if (shouldAutoStartBreak || shouldAutoStartFocus) {
        // Small delay before starting next phase for better UX
        setTimeout(() => {
          skipToNextPhase();
          startTimer();
        }, 1500);
      }
    }
  }, [remainingTime, timerState, timerPhase, linkedTodoId, completeSession, incrementPomodoro, incrementPomodoroCount, pomodoroSettings.focusDuration, pomodoroSettings.autoStartBreaks, pomodoroSettings.autoStartFocus, stopTimer, skipToNextPhase, startTimer]);

  // Set up notification action callbacks
  useEffect(() => {
    notificationService.setActionCallbacks({
      onPause: () => pauseTimer(),
      onResume: () => resumeTimer(),
      onStop: () => stopTimer(),
    });
  }, [pauseTimer, resumeTimer, stopTimer]);

  // Show/update ongoing notification based on timer state changes
  // Note: We only update on state changes, not every second
  // Android chronometer handles the countdown automatically
  useEffect(() => {
    if (timerState === 'running') {
      // Show notification when timer starts running
      notificationService.showTimerNotification(
        timerPhase as 'focus' | 'short_break' | 'long_break',
        remainingTime,
        totalTime,
        false
      );
    } else if (timerState === 'paused') {
      // Update notification to show paused state
      notificationService.showTimerNotification(
        timerPhase as 'focus' | 'short_break' | 'long_break',
        remainingTime,
        totalTime,
        true
      );
    } else if (timerState === 'stopped') {
      // Dismiss notification when timer is stopped
      notificationService.dismissTimerNotification();
    }
    // Only trigger on state/phase changes, not every remainingTime change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerState, timerPhase]);

  // Cleanup notification on unmount
  useEffect(() => {
    return () => {
      notificationService.dismissTimerNotification();
    };
  }, []);

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
    stopTimer();
    // Dismiss any ongoing notification
    notificationService.dismissTimerNotification();
  };

  const handleSkip = () => {
    stopTimer();
    skipToNextPhase();
  };

  // Timer circle dimensions
  const circleSize = 280;
  const strokeWidth = 12;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text category="h5">Focus Timer</Text>
        <Text category="s1" style={{ color: colors.textSecondary }}>
          Session {sessionsCompleted + 1}
        </Text>
      </View>

      {/* Timer Circle */}
      <View style={styles.timerContainer}>
        <CircularProgress
          size={circleSize}
          strokeWidth={strokeWidth}
          progress={getProgress()}
          progressColor={getPhaseColor()}
          backgroundColor={colors.border}
        >
          <View style={styles.timerContent}>
            <Text
              category="h1"
              style={[styles.timeText, { color: getPhaseColor() }]}
            >
              {formatTime()}
            </Text>
            <Text category="s1" style={{ color: colors.textSecondary }}>
              {getPhaseLabel()}
            </Text>
            {remainingTime === 0 && timerState === "running" && (
              <Text
                category="c1"
                style={{ color: colors.warning, marginTop: Spacing.xs }}
              >
                Time&apos;s up! Tap stop when ready.
              </Text>
            )}
          </View>
        </CircularProgress>
      </View>

      {/* Session dots */}
      <View style={styles.sessionDots}>
        {Array.from({ length: pomodoroSettings.sessionsUntilLongBreak }).map(
          (_, i) => (
            <View
              key={i}
              style={[
                styles.sessionDot,
                {
                  backgroundColor:
                    i < sessionsCompleted
                      ? colors.primary
                      : colors.border,
                },
              ]}
            />
          ),
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {timerState === "stopped" ? (
          <Button
            style={styles.mainButton}
            size="giant"
            accessoryLeft={(props) => (
              <Icon {...props} name="play-circle-outline" />
            )}
            onPress={handleStart}
          >
            Start Focus
          </Button>
        ) : (
          <View style={styles.activeControls}>
            <Button
              style={styles.controlButton}
              appearance="outline"
              status="danger"
              accessoryLeft={(props) => (
                <Icon {...props} name="stop-circle-outline" />
              )}
              onPress={handleStop}
            >
              Stop
            </Button>
            <Button
              style={styles.controlButton}
              accessoryLeft={(props) => (
                <Icon
                  {...props}
                  name={
                    timerState === "running"
                      ? "pause-circle-outline"
                      : "play-circle-outline"
                  }
                />
              )}
              onPress={handlePauseResume}
            >
              {timerState === "running" ? "Pause" : "Resume"}
            </Button>
          </View>
        )}
      </View>

      {/* Skip button */}
      {timerState !== "stopped" && (
        <Button
          appearance="ghost"
          size="small"
          accessoryRight={(props) => (
            <Icon {...props} name="skip-forward-outline" />
          )}
          onPress={handleSkip}
        >
          Skip to {timerPhase === "focus" ? "Break" : "Focus"}
        </Button>
      )}

      {/* Linked Todo */}
      {linkedTodoId && (
        <Card style={[styles.linkedCard, { backgroundColor: colors.card }]}>
          <View style={styles.linkedContent}>
            <Icon
              name="link-outline"
              fill={colors.textMuted}
              style={styles.linkIcon}
            />
            <Text category="s2" style={{ color: colors.textSecondary }}>
              Working on linked task
            </Text>
          </View>
        </Card>
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
  timerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  timerContent: {
    alignItems: "center",
  },
  timeText: {
    fontSize: 56,
    fontWeight: "200",
  },
  sessionDots: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  sessionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  controls: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    width: "100%",
  },
  mainButton: {
    borderRadius: BorderRadius.xl,
  },
  activeControls: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  controlButton: {
    flex: 1,
    borderRadius: BorderRadius.lg,
  },
  linkedCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  linkedContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  linkIcon: {
    width: 20,
    height: 20,
  },
});
