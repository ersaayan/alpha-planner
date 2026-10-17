import { Icon } from "@/components/icon";
import { CircularProgress } from "@/components/pomodoro";
import { Text } from "@ui-kitten/components";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useIsFocused } from "expo-router";
import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
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
  Spacing,
} from "@/constants/theme";
import { useAlertPermissions } from "@/hooks/use-alert-permissions";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  openChannelSettings,
  requestExactAlarmPermission,
  requestNotificationPermission,
} from "@/services/notifications/alert-permissions";
import { alertChannelId } from "@/services/notifications/pomodoro-alerts";
import {
  usePomodoroClock,
  usePomodoroStore,
  useSettingsStore,
  useTodoStore,
} from "@/stores";
import { formatClock } from "@/utils/pomodoro-helpers";

const KEEP_AWAKE_TAG = "pomodoro-timer";
const MIN_CIRCLE = 150;
const MAX_CIRCLE = 320;

// Ask for notification permission at most once per app session from the Start button.
let askedForPermissionThisSession = false;

function confirmAsync(title: string, message: string, cancel: string, ok: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancel, style: "cancel", onPress: () => resolve(false) },
        { text: ok, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export default function PomodoroScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();

  // Select primitive values individually
  const remainingSeconds = usePomodoroClock((state) => state.remainingSeconds);
  const totalTime = usePomodoroStore((state) => state.timer.totalTime);
  const timerState = usePomodoroStore((state) => state.timer.state);
  const timerPhase = usePomodoroStore((state) => state.timer.phase);
  const linkedTodoId = usePomodoroStore((state) => state.timer.linkedTodoId);
  const sessionsCompleted = usePomodoroStore((state) => state.timer.sessionsCompleted);

  const linkedTodo = useTodoStore((state) =>
    linkedTodoId ? state.todos.find((todo) => todo.id === linkedTodoId) : null,
  );

  const startTimer = usePomodoroStore((state) => state.startTimer);
  const pauseTimer = usePomodoroStore((state) => state.pauseTimer);
  const resumeTimer = usePomodoroStore((state) => state.resumeTimer);
  const stopTimer = usePomodoroStore((state) => state.stopTimer);
  const skipToNextPhase = usePomodoroStore((state) => state.skipToNextPhase);
  const linkTodo = usePomodoroStore((state) => state.linkTodo);
  const refreshAlerts = usePomodoroStore((state) => state.refreshAlerts);
  const keepScreenAwake = useSettingsStore((state) => state.pomodoroSettings.keepScreenAwake);
  const sessionsUntilLongBreak = useSettingsStore(
    (state) => state.pomodoroSettings.sessionsUntilLongBreak,
  );
  const vibrationEnabled = useSettingsStore((state) => state.pomodoroSettings.vibrationEnabled);
  const notificationsEnabled = useSettingsStore((state) => state.settings.notificationsEnabled);
  const soundEnabled = useSettingsStore((state) => state.settings.soundEnabled);
  const { permissions, refresh: refreshPermissions } = useAlertPermissions();

  const progress =
    totalTime > 0 ? Math.min(1, Math.max(0, 1 - remainingSeconds / totalTime)) : 0;
  const isRunning = timerState === "running";

  // Keep the screen on only while this screen is visible and the timer runs.
  useEffect(() => {
    if (!keepScreenAwake || !isFocused || !isRunning) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      void Promise.resolve(deactivateKeepAwake(KEEP_AWAKE_TAG)).catch(() => undefined);
    };
  }, [keepScreenAwake, isFocused, isRunning]);

  function phaseLabel(phase: typeof timerPhase) {
    switch (phase) {
      case "focus":
        return t("pomodoro.focusTime");
      case "short_break":
        return t("pomodoro.shortBreak");
      case "long_break":
        return t("pomodoro.longBreak");
      default:
        return t("pomodoro.readyToFocus");
    }
  }

  const sessionDotScale = useSharedValue(1);

  // Announce phase changes for screen readers and bounce the current session dot.
  const prevPhaseRef = useRef(timerPhase);
  const prevTimerStateRef = useRef(timerState);
  useEffect(() => {
    const completedPhase = prevPhaseRef.current;
    if (completedPhase !== timerPhase && prevTimerStateRef.current === "running") {
      AccessibilityInfo.announceForAccessibility(
        t("pomodoro.phaseComplete", { phase: phaseLabel(completedPhase) }),
      );
      sessionDotScale.set(
        withSequence(withSpring(1.3, SpringConfig.bouncy), withSpring(1, SpringConfig.default)),
      );
    }
    prevPhaseRef.current = timerPhase;
    prevTimerStateRef.current = timerState;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only phase/state transitions matter
  }, [timerPhase, timerState]);

  const phaseColor =
    timerPhase === "focus"
      ? colors.timerFocus
      : timerPhase === "idle"
        ? colors.timerIdle
        : colors.timerBreak;
  const phaseSecondaryColor =
    timerPhase === "focus"
      ? GamificationColors.progressEnd
      : timerPhase === "idle"
        ? colors.textMuted
        : colors.secondary;
  const phaseIcon = timerPhase === "focus" ? "bulb" : timerPhase === "idle" ? "clock" : "coffee";
  const isBreak = timerPhase === "short_break" || timerPhase === "long_break";

  const handleStart = async () => {
    if (
      notificationsEnabled &&
      permissions?.notifications === "undetermined" &&
      permissions.canAskAgain &&
      !askedForPermissionThisSession
    ) {
      askedForPermissionThisSession = true;
      const proceed = await confirmAsync(
        t("pomodoro.permissionTitle"),
        t("pomodoro.permissionMessage"),
        t("common.skip"),
        t("common.continue"),
      );
      if (proceed) {
        await requestNotificationPermission().catch(() => undefined);
        void refreshPermissions();
      }
    }
    startTimer();
  };

  const handlePauseResume = () => {
    if (isRunning) {
      pauseTimer();
    } else {
      resumeTimer();
    }
  };

  const handleStop = () => {
    Alert.alert(t("pomodoro.stopTitle"), t("pomodoro.stopMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("pomodoro.stop"), style: "destructive", onPress: stopTimer },
    ]);
  };

  const sessionDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sessionDotScale.value }],
  }));

  // Size the circle from the space it actually has (small phones, linked task card).
  const [timerAreaHeight, setTimerAreaHeight] = useState<number | null>(null);
  const handleTimerAreaLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setTimerAreaHeight((previous) => (previous === height ? previous : height));
  };
  const widthLimit = width - Spacing.xl * 2;
  const heightLimit = timerAreaHeight === null ? widthLimit : timerAreaHeight - Spacing.md * 2;
  const circleSize = Math.round(
    Math.max(MIN_CIRCLE, Math.min(MAX_CIRCLE, widthLimit, heightLimit)),
  );
  const strokeWidth = circleSize < 220 ? 10 : 14;
  const timeFontSize = Math.round(circleSize * 0.22);
  const bottomInset = (tabBarHeight ?? Math.max(insets.bottom, 20) + 80) + Spacing.sm;

  const cycleSessionIndex = sessionsCompleted % Math.max(1, sessionsUntilLongBreak);

  // One banner at a time, most important first.
  let banner: { message: string; action: string; onPress: () => void } | null = null;
  if (notificationsEnabled && permissions) {
    if (permissions.notifications === "denied") {
      banner = {
        message: t("pomodoro.notificationsOff"),
        action: permissions.canAskAgain ? t("pomodoro.allow") : t("pomodoro.openSettings"),
        onPress: async () => {
          if (permissions.canAskAgain) {
            await requestNotificationPermission().catch(() => undefined);
          } else {
            await Linking.openSettings();
          }
          void refreshPermissions();
          refreshAlerts();
        },
      };
    } else if (permissions.alertChannelEnabled === false) {
      banner = {
        message: t("pomodoro.channelOff"),
        action: t("pomodoro.openSettings"),
        onPress: () => openChannelSettings(alertChannelId(soundEnabled, vibrationEnabled)),
      };
    } else if (Platform.OS === "android" && !permissions.exactAlarms) {
      banner = {
        message: t("pomodoro.exactAlarmsOff"),
        action: t("pomodoro.allow"),
        onPress: async () => {
          const granted = await requestExactAlarmPermission();
          void refreshPermissions();
          // Alarms set without the permission are inexact; set them again.
          if (granted) refreshAlerts();
        },
      };
    }
  }

  const timeText = formatClock(remainingSeconds);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: bottomInset,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">
          {t("pomodoro.title")}
        </Text>
        <View style={[styles.sessionBadge, { backgroundColor: colors.primary + "20" }]}>
          <Icon name="flag" fill={colors.primary} style={styles.sessionIcon} />
          <Text style={[styles.sessionText, { color: colors.primary }]}>
            {t("pomodoro.session", { number: cycleSessionIndex + 1 })}
          </Text>
        </View>
      </View>

      {banner && (
        <View
          style={[styles.banner, { backgroundColor: colors.warning + "20" }]}
          accessibilityRole="alert"
        >
          <Icon name="bell-off" fill={colors.warning} style={styles.bannerIcon} />
          <Text style={[styles.bannerText, { color: colors.text }]}>{banner.message}</Text>
          <Pressable
            onPress={banner.onPress}
            style={[styles.bannerButton, { borderColor: colors.warning }]}
            hitSlop={4}
            accessibilityRole="button"
          >
            <Text style={[styles.bannerButtonText, { color: colors.text }]}>{banner.action}</Text>
          </Pressable>
        </View>
      )}

      {/* Timer Circle */}
      <View style={styles.timerContainer} onLayout={handleTimerAreaLayout}>
        <CircularProgress
          size={circleSize}
          strokeWidth={strokeWidth}
          progress={progress}
          progressColor={phaseColor}
          secondaryColor={phaseSecondaryColor}
          backgroundColor={colors.border}
          showGlow={isRunning}
          // The pulse is decorative: pause it while another tab is shown.
          isRunning={isRunning && isFocused}
        >
          <View style={styles.timerContent}>
            <View style={[styles.phaseBadge, { backgroundColor: phaseColor + "20" }]}>
              <Icon name={phaseIcon} fill={phaseColor} style={styles.phaseIcon} />
              <Text style={[styles.phaseLabel, { color: phaseColor }]} maxFontSizeMultiplier={1.3}>
                {/* Upper-cased for the app language (CSS-style uppercase would use the device locale: "I" for Turkish "i") */}
                {phaseLabel(timerPhase).toLocaleUpperCase(i18n.language)}
              </Text>
            </View>

            <Text
              style={[styles.timeText, { color: colors.text, fontSize: timeFontSize }]}
              // Already sized from the circle; larger text would overflow it.
              maxFontSizeMultiplier={1}
              accessibilityLabel={t("pomodoro.timeRemaining", { time: timeText })}
            >
              {timeText}
            </Text>
          </View>
        </CircularProgress>
      </View>

      {/* Session dots */}
      <View
        style={styles.sessionDots}
        accessible
        accessibilityLabel={t("pomodoro.sessionProgress", {
          current: cycleSessionIndex + 1,
          total: sessionsUntilLongBreak,
        })}
      >
        {Array.from({ length: sessionsUntilLongBreak }).map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.sessionDot,
              i === cycleSessionIndex && sessionDotStyle,
              {
                backgroundColor: i < cycleSessionIndex ? colors.primary : colors.border,
                borderColor: i === cycleSessionIndex ? colors.primary : "transparent",
                borderWidth: i === cycleSessionIndex ? 2 : 0,
              },
            ]}
          >
            {i < cycleSessionIndex && <Icon name="checkmark" fill={colors.onPrimary} style={styles.dotCheck} />}
          </Animated.View>
        ))}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {timerState === "stopped" ? (
          <AnimatedButton
            title={isBreak ? t("pomodoro.startBreak") : t("pomodoro.startFocus")}
            icon="play"
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleStart}
          />
        ) : (
          <View style={styles.activeControls}>
            <AnimatedButton
              title={t("pomodoro.stop")}
              icon="stop-circle"
              variant="danger"
              size="md"
              style={styles.controlButton}
              onPress={handleStop}
            />
            <AnimatedButton
              title={isRunning ? t("pomodoro.pause") : t("pomodoro.resume")}
              icon={isRunning ? "pause" : "play"}
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
        <Pressable style={styles.skipButton} onPress={skipToNextPhase} accessibilityRole="button">
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>
            {timerPhase === "focus" ? t("pomodoro.skipToBreak") : t("pomodoro.skipToFocus")}
          </Text>
          <Icon name="skip-forward" fill={colors.textSecondary} style={styles.skipIcon} />
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
          <View style={[styles.linkedIconContainer, { backgroundColor: colors.primary + "20" }]}>
            <Icon name="link-2" fill={colors.primary} style={styles.linkedIcon} />
          </View>
          <View style={styles.linkedTextContainer}>
            <Text style={[styles.linkedLabel, { color: colors.textMuted }]}>
              {t("pomodoro.currentlyWorkingOn")}
            </Text>
            <Text
              style={[styles.linkedTitle, { color: linkedTodo ? colors.text : colors.textSecondary }]}
              numberOfLines={1}
            >
              {linkedTodo?.title ?? t("pomodoro.linkedTaskNotFound")}
            </Text>
          </View>
          <Pressable
            style={[styles.unlinkButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => linkTodo(null)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t("pomodoro.unlinkTask")}
          >
            <Icon name="close" fill={colors.textMuted} style={styles.unlinkIcon} />
            <Text style={[styles.unlinkText, { color: colors.textMuted }]}>{t("pomodoro.unlink")}</Text>
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
    paddingVertical: Spacing.md,
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
  banner: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  bannerIcon: {
    width: 18,
    height: 18,
  },
  bannerText: {
    flex: 1,
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
  },
  bannerButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  bannerButtonText: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xs,
  },
  timerContainer: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "center",
    alignItems: "center",
    minHeight: MIN_CIRCLE,
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
    marginBottom: Spacing.sm,
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
  },
  timeText: {
    fontFamily: InterFonts.light,
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
  },
  sessionDots: {
    flexDirection: "row",
    gap: Spacing.md,
    marginVertical: Spacing.md,
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
    paddingBottom: Spacing.sm,
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
    minHeight: 44,
    paddingVertical: Spacing.sm,
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
    marginTop: Spacing.sm,
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
    minHeight: 36,
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
