/**
 * AnimatedButton - Button with press animation and ripple effect
 */

import React from 'react';
import { StyleSheet, ViewStyle, TextStyle, Pressable, PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Text } from '@ui-kitten/components';
import { Colors, Shadows, Spacing, InterFonts, FontSize } from '@/constants/theme';
import { SpringConfig, AnimationPresets } from '@/constants/animations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Icon } from '@/components/icon';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedButtonProps extends Omit<PressableProps, 'style'> {
  title?: string;
  icon?: string;
  iconPosition?: 'left' | 'right';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function AnimatedButton({
  title,
  icon,
  iconPosition = 'left',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  style,
  onPress,
  ...pressableProps
}: AnimatedButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const sizeConfig = {
    sm: { height: 36, paddingH: Spacing.md, fontSize: FontSize.sm, iconSize: 16 },
    md: { height: 44, paddingH: Spacing.lg, fontSize: FontSize.md, iconSize: 20 },
    lg: { height: 52, paddingH: Spacing.xl, fontSize: FontSize.lg, iconSize: 24 },
  };

  const config = sizeConfig[size];

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle; iconColor: string } => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: colors.primary,
            ...Shadows.sm,
          },
          text: { color: '#fff' },
          iconColor: '#fff',
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: colors.secondary,
          },
          text: { color: colors.text },
          iconColor: colors.text,
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderColor: colors.primary,
          },
          text: { color: colors.primary },
          iconColor: colors.primary,
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: { color: colors.primary },
          iconColor: colors.primary,
        };
      case 'danger':
        return {
          container: {
            backgroundColor: colors.error,
            ...Shadows.sm,
          },
          text: { color: '#fff' },
          iconColor: '#fff',
        };
      default:
        return {
          container: { backgroundColor: colors.primary },
          text: { color: '#fff' },
          iconColor: '#fff',
        };
    }
  };

  const variantStyles = getVariantStyles();

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(AnimationPresets.buttonPress.scale, SpringConfig.snappy);
      pressed.value = withSpring(1, SpringConfig.snappy);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SpringConfig.default);
    pressed.value = withSpring(0, SpringConfig.default);
  };

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      pressed.value,
      [0, 1],
      [1, 0.9],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale: scale.value }],
      opacity: disabled ? 0.5 : opacity,
    };
  });

  const renderIcon = () => {
    if (!icon) return null;
    return (
      <Icon
        name={icon}
        fill={variantStyles.iconColor}
        style={{
          width: config.iconSize,
          height: config.iconSize,
          marginRight: title && iconPosition === 'left' ? Spacing.sm : 0,
          marginLeft: title && iconPosition === 'right' ? Spacing.sm : 0,
        }}
      />
    );
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={pressableProps.accessibilityLabel ?? title}
      style={[
        styles.button,
        {
          height: config.height,
          paddingHorizontal: config.paddingH,
          borderRadius: config.height / 2, // Pill shape
        },
        variantStyles.container,
        fullWidth && styles.fullWidth,
        animatedStyle,
        style,
      ]}
      {...pressableProps}
    >
      {loading ? (
        <Animated.View style={styles.loadingContainer}>
          <Text style={[styles.text, variantStyles.text, { fontSize: config.fontSize }]}>
            ...
          </Text>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.content, iconPosition === 'right' && styles.contentReverse]}>
          {iconPosition === 'left' && renderIcon()}
          {title && (
            <Text
              style={[
                styles.text,
                variantStyles.text,
                { fontSize: config.fontSize },
              ]}
            >
              {title}
            </Text>
          )}
          {iconPosition === 'right' && renderIcon()}
        </Animated.View>
      )}
    </AnimatedPressable>
  );
}

// Floating Action Button variant
interface FABProps extends Omit<AnimatedButtonProps, 'title' | 'variant' | 'size'> {
  icon: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function FAB({
  icon,
  size = 'md',
  color,
  style,
  ...props
}: FABProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const sizeConfig = {
    sm: { size: 44, icon: 20 },
    md: { size: 56, icon: 24 },
    lg: { size: 68, icon: 28 },
  };

  const config = sizeConfig[size];
  const bgColor = color || colors.primary;

  return (
    <AnimatedButton
      icon={icon}
      variant="primary"
      style={{
        width: config.size,
        height: config.size,
        borderRadius: config.size / 2,
        paddingHorizontal: 0,
        backgroundColor: bgColor,
        ...Shadows.lg,
        ...style,
      }}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentReverse: {
    flexDirection: 'row-reverse',
  },
  text: {
    fontFamily: InterFonts.semibold,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AnimatedButton;
