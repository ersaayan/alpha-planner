/**
 * AnimatedCard - Card with press scale animation and shadow
 */

import React from 'react';
import { StyleSheet, ViewStyle, Pressable, PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { Colors, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { SpringConfig, AnimationPresets } from '@/constants/animations';
import { useColorScheme } from '@/hooks/use-color-scheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedCardProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'filled';
  pressScale?: number;
  disabled?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  accentColor?: string;
  accentPosition?: 'left' | 'top' | 'none';
}

export function AnimatedCard({
  children,
  variant = 'default',
  pressScale = AnimationPresets.cardPress.scale,
  disabled = false,
  style,
  contentStyle,
  accentColor,
  accentPosition = 'none',
  onPress,
  ...pressableProps
}: AnimatedCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const handlePressIn = () => {
    if (!disabled && onPress) {
      scale.value = withSpring(pressScale, SpringConfig.snappy);
      pressed.value = withSpring(1, SpringConfig.snappy);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SpringConfig.default);
    pressed.value = withSpring(0, SpringConfig.default);
  };

  const animatedStyle = useAnimatedStyle(() => {
    const shadowOpacity = interpolate(
      pressed.value,
      [0, 1],
      [variant === 'elevated' ? 0.12 : 0.08, 0.04]
    );

    return {
      transform: [{ scale: scale.value }],
      shadowOpacity,
    };
  });

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.card,
          ...Shadows.md,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'filled':
        return {
          backgroundColor: colors.backgroundSecondary,
        };
      case 'default':
      default:
        return {
          backgroundColor: colors.card,
          ...Shadows.sm,
        };
    }
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || !onPress}
      style={[
        styles.card,
        getVariantStyle(),
        animatedStyle,
        disabled && styles.disabled,
        style,
      ]}
      {...pressableProps}
    >
      {/* Accent border */}
      {accentColor && accentPosition !== 'none' && (
        <Animated.View
          style={[
            styles.accent,
            accentPosition === 'left' && styles.accentLeft,
            accentPosition === 'top' && styles.accentTop,
            { backgroundColor: accentColor },
          ]}
        />
      )}

      {/* Content */}
      <Animated.View style={[styles.content, contentStyle]}>
        {children}
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    padding: Spacing.md,
  },
  disabled: {
    opacity: 0.6,
  },
  accent: {
    position: 'absolute',
  },
  accentLeft: {
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  accentTop: {
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
});

export default AnimatedCard;
