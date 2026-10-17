/**
 * AnimatedCounter - a number that bounces when it changes.
 *
 * It used to count up frame by frame by sending every intermediate value from the UI
 * thread to React (runOnJS + setState ~60 times a second per counter). Now the text
 * shows the real value at once, formatted for the app language, and only the bounce
 * runs on the UI thread. Screen readers always get the final value.
 */

import { Text } from '@ui-kitten/components';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Colors, Typography } from '@/constants/theme';
import { useAmbientMotion } from '@/hooks/use-ambient-motion';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  formatNumber?: (value: number) => string;
  style?: TextStyle;
  category?: 'h1' | 'h2' | 'h3' | 'stat' | 'body';
  color?: string;
  bounceOnChange?: boolean;
}

const TYPOGRAPHY = {
  h1: Typography.h1,
  h2: Typography.h2,
  h3: Typography.h3,
  stat: Typography.stat,
  body: Typography.body,
} as const;

export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  formatNumber,
  style,
  category = 'stat',
  color,
  bounceOnChange = true,
}: AnimatedCounterProps) {
  const { i18n } = useTranslation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const motion = useAmbientMotion(bounceOnChange);
  const scale = useSharedValue(1);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    if (motion) {
      scale.set(withSequence(withTiming(1.1, { duration: 100 }), withSpring(1, { damping: 10, stiffness: 200 })));
    }
  }, [value, motion, scale]);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const rounded = Math.round(value);
  const text = formatNumber ? formatNumber(rounded) : rounded.toLocaleString(i18n.language);

  return (
    <Animated.View style={scaleStyle}>
      <Text style={{ ...TYPOGRAPHY[category], color: color || colors.text, ...style }}>
        {`${prefix}${text}${suffix}`}
      </Text>
    </Animated.View>
  );
}

export default AnimatedCounter;
