/**
 * AnimatedCounter - Number counter with smooth counting animation
 */

import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withSpring,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { Text } from '@ui-kitten/components';
import { Colors, InterFonts, FontSize, Typography } from '@/constants/theme';
import { AnimationDuration, AnimationEasing } from '@/constants/animations';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  formatNumber?: (value: number) => string;
  style?: TextStyle;
  category?: 'h1' | 'h2' | 'h3' | 'stat' | 'body';
  color?: string;
  bounceOnChange?: boolean;
}

export function AnimatedCounter({
  value,
  duration = AnimationDuration.slow,
  prefix = '',
  suffix = '',
  formatNumber,
  style,
  category = 'stat',
  color,
  bounceOnChange = true,
}: AnimatedCounterProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const textColor = color || colors.text;

  const animatedValue = useSharedValue(0);
  const scale = useSharedValue(1);
  const previousValue = useSharedValue(0);
  const [displayText, setDisplayText] = useState('0');

  const updateDisplayText = useCallback((roundedValue: number) => {
    if (formatNumber) {
      setDisplayText(formatNumber(roundedValue));
    } else {
      setDisplayText(roundedValue.toLocaleString());
    }
  }, [formatNumber]);

  useEffect(() => {
    const diff = Math.abs(value - previousValue.value);

    // Animate the number
    animatedValue.value = withTiming(value, {
      duration: Math.min(duration, diff * 50 + 200), // Scale duration with change magnitude
      easing: AnimationEasing.decelerate,
    });

    // Bounce animation on significant changes
    if (bounceOnChange && diff > 0) {
      scale.value = withSequence(
        withTiming(1.1, { duration: 100 }),
        withSpring(1, { damping: 10, stiffness: 200 })
      );
    }

    previousValue.value = value;

    // The reaction below may not reach the JS thread on every platform (e.g. the web):
    // show the final value once the animation is over in any case.
    const settle = setTimeout(() => updateDisplayText(Math.round(value)), duration + 50);
    return () => clearTimeout(settle);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Reanimated shared values are stable refs
  }, [value, duration]);

  // Transfer animated value to JS thread for display
  useAnimatedReaction(
    () => Math.round(animatedValue.value),
    (roundedValue) => {
      runOnJS(updateDisplayText)(roundedValue);
    },
  );

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Get typography style based on category
  const getTypographyStyle = (): TextStyle => {
    switch (category) {
      case 'h1':
        return Typography.h1;
      case 'h2':
        return Typography.h2;
      case 'h3':
        return Typography.h3;
      case 'stat':
        return Typography.stat;
      case 'body':
      default:
        return Typography.body;
    }
  };

  return (
    <Animated.View style={scaleStyle}>
      <Text style={{ ...getTypographyStyle(), color: textColor, ...style }}>
        {prefix}{displayText}{suffix}
      </Text>
    </Animated.View>
  );
}

// Specialized counter for XP display
interface XPCounterProps {
  currentXP: number;
  totalXP: number;
  style?: TextStyle;
}

export function XPCounter({ currentXP, totalXP, style }: XPCounterProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Animated.View style={styles.xpContainer}>
      <AnimatedCounter
        value={currentXP}
        category="stat"
        color={colors.primary}
        style={style}
      />
      <Text style={[styles.xpSeparator, { color: colors.textMuted }]}>
        {' / '}
      </Text>
      <Text style={[styles.xpTotal, { color: colors.textMuted }]}>
        {totalXP}
      </Text>
      <Text style={[styles.xpLabel, { color: colors.textMuted }]}>
        {' XP'}
      </Text>
    </Animated.View>
  );
}

// Specialized counter for streak display
interface StreakCounterProps {
  streak: number;
  style?: TextStyle;
}

export function StreakCounter({ streak, style }: StreakCounterProps) {
  return (
    <AnimatedCounter
      value={streak}
      suffix=" days"
      category="h3"
      bounceOnChange={true}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  xpContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  xpSeparator: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.lg,
  },
  xpTotal: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.lg,
  },
  xpLabel: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
  },
});

export default AnimatedCounter;
