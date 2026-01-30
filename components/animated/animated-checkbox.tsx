/**
 * AnimatedCheckbox - Checkbox with draw animation and ripple effect
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors, BorderRadius, Shadows } from '@/constants/theme';
import { SpringConfig, AnimationDuration } from '@/constants/animations';
import { useColorScheme } from '@/hooks/use-color-scheme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface AnimatedCheckboxProps {
  checked: boolean;
  onToggle?: (checked: boolean) => void;
  size?: number;
  color?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export function AnimatedCheckbox({
  checked,
  onToggle,
  size = 24,
  color,
  disabled = false,
  style,
}: AnimatedCheckboxProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const checkColor = color || colors.primary;

  const checkProgress = useSharedValue(checked ? 1 : 0);
  const scale = useSharedValue(1);
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0);

  // Checkmark path length (approximate)
  const pathLength = 24;

  useEffect(() => {
    if (checked) {
      // Check animation with scale bounce
      scale.value = withSequence(
        withTiming(0.9, { duration: AnimationDuration.fast }),
        withSpring(1.1, SpringConfig.bouncy),
        withSpring(1, SpringConfig.default)
      );
      checkProgress.value = withDelay(
        100,
        withTiming(1, { duration: AnimationDuration.medium })
      );
    } else {
      // Uncheck animation
      scale.value = withSequence(
        withTiming(0.95, { duration: AnimationDuration.fast }),
        withSpring(1, SpringConfig.default)
      );
      checkProgress.value = withTiming(0, { duration: AnimationDuration.fast });
    }
  }, [checked]);

  const handlePress = () => {
    if (disabled) return;

    // Trigger ripple
    rippleScale.value = 0;
    rippleOpacity.value = 0.3;
    rippleScale.value = withTiming(2, { duration: AnimationDuration.slow });
    rippleOpacity.value = withDelay(
      AnimationDuration.fast,
      withTiming(0, { duration: AnimationDuration.medium })
    );

    onToggle?.(!checked);
  };

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  const checkboxStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolate(
      checkProgress.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    );

    return {
      backgroundColor: backgroundColor === 1 ? checkColor : 'transparent',
      borderColor: checkProgress.value > 0.5 ? checkColor : colors.border,
    };
  });

  const checkmarkProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(
      checkProgress.value,
      [0, 1],
      [pathLength, 0],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <Pressable onPress={handlePress} disabled={disabled} style={style}>
      <Animated.View style={[styles.container, { width: size, height: size }, containerStyle]}>
        {/* Ripple effect */}
        <Animated.View
          style={[
            styles.ripple,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: checkColor,
            },
            rippleStyle,
          ]}
        />

        {/* Checkbox box */}
        <Animated.View
          style={[
            styles.checkbox,
            {
              width: size,
              height: size,
              borderRadius: BorderRadius.sm,
            },
            checkboxStyle,
          ]}
        >
          {/* Checkmark SVG */}
          <Svg
            width={size * 0.6}
            height={size * 0.6}
            viewBox="0 0 24 24"
            style={styles.checkmark}
          >
            <AnimatedPath
              d="M4 12.5L9.5 18L20 6"
              stroke="#fff"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={pathLength}
              animatedProps={checkmarkProps}
            />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ripple: {
    position: 'absolute',
  },
  checkbox: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  checkmark: {
    position: 'absolute',
  },
});

export default AnimatedCheckbox;
