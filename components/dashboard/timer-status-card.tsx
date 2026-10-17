import { Text } from '@ui-kitten/components';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedCard } from '@/components/animated/animated-card';
import { Icon } from '@/components/icon';
import { BorderRadius, Colors, FontSize, InterFonts, Shadows, Spacing } from '@/constants/theme';
import { useAmbientMotion } from '@/hooks/use-ambient-motion';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePomodoroClock, usePomodoroStore } from '@/stores';
import { formatClock } from '@/utils/pomodoro-helpers';

/**
 * The running or paused timer on the Dashboard. It is the only part of the Dashboard
 * that subscribes to the per-second clock, so the rest of the screen does not
 * re-render every second. Renders nothing while the timer is stopped.
 */
export function TimerStatusCard({ active }: { /** The screen is focused (pulse only then). */ active: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = Colors[useColorScheme() ?? 'light'];
  const timerState = usePomodoroStore((state) => state.timer.state);
  const timerPhase = usePomodoroStore((state) => state.timer.phase);
  const pulse = useAmbientMotion(active && timerState === 'running');

  const scale = useSharedValue(1);
  useEffect(() => {
    if (pulse) {
      scale.set(
        withRepeat(
          withSequence(
            withTiming(1.02, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );
    } else {
      scale.set(withTiming(1, { duration: 200 }));
    }
    return () => cancelAnimation(scale);
  }, [pulse, scale]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (timerState === 'stopped') return null;

  const phaseLabel = timerPhase === 'focus' ? t('dashboard.focusTime') : t('dashboard.breakTime');

  return (
    <Animated.View style={pulseStyle}>
      <AnimatedCard
        variant="elevated"
        style={styles.card}
        contentStyle={styles.content}
        onPress={() => router.push('/(tabs)/pomodoro')}
        accessibilityHint={t('dashboard.openTimerHint')}
      >
        {timerState === 'running' && <View style={[styles.glow, { backgroundColor: colors.primary }]} />}

        <View style={styles.info}>
          <View style={[styles.phaseBadge, { backgroundColor: colors.primary + '20' }]}>
            <Icon name={timerPhase === 'focus' ? 'bulb' : 'coffee'} fill={colors.primary} size={14} />
            <Text style={[styles.phaseText, { color: colors.primary }]}>{phaseLabel}</Text>
          </View>
          <LiveTime color={colors.text} />
        </View>

        <View style={[styles.action, { backgroundColor: colors.primary }]}>
          <Icon name={timerState === 'running' ? 'pause' : 'play'} fill={colors.onPrimary} size={24} />
        </View>
      </AnimatedCard>
    </Animated.View>
  );
}

/** Only this text re-renders every second. */
function LiveTime({ color }: { color: string }) {
  const remaining = usePomodoroClock((state) => state.remainingSeconds);
  return (
    <Text style={[styles.time, { color }]} maxFontSizeMultiplier={1.2}>
      {formatClock(remaining)}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  glow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.1,
  },
  info: {
    flex: 1,
  },
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
  },
  phaseText: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xs,
  },
  time: {
    fontFamily: InterFonts.light,
    fontSize: 48,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  action: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
});
