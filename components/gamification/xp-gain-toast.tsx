/**
 * XPGainToast - Toast notification for XP gains
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Text } from '@ui-kitten/components';
import { Colors, GamificationColors, BorderRadius, Shadows, Spacing, InterFonts, FontSize, Palette } from '@/constants/theme';
import { SpringConfig, AnimationDuration } from '@/constants/animations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Icon } from '@/components/icon';

interface XPGainToastProps {
  amount: number;
  reason?: string;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

export function XPGainToast({
  amount,
  reason,
  visible,
  onHide,
  duration = 2500,
}: XPGainToastProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      // Animate in then auto-hide with withSequence to avoid conflicting animations
      translateY.value = withSequence(
        withSpring(0, SpringConfig.bouncy),
        withDelay(
          duration - AnimationDuration.medium,
          withTiming(-100, { duration: AnimationDuration.medium }, (finished) => {
            if (finished) {
              runOnJS(onHide)();
            }
          })
        )
      );
      opacity.value = withSequence(
        withTiming(1, { duration: AnimationDuration.fast }),
        withDelay(
          duration - AnimationDuration.medium,
          withTiming(0, { duration: AnimationDuration.medium })
        )
      );
      scale.value = withSequence(
        withSpring(1.1, SpringConfig.bouncy),
        withSpring(1, SpringConfig.default)
      );
    }
  }, [visible, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, animatedStyle]}
      accessible={true}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Gained ${amount} XP${reason ? `, ${reason}` : ''}`}
    >
      <View style={[styles.toast, { backgroundColor: colors.card, maxWidth: SCREEN_WIDTH - Spacing.xl * 2 }, Shadows.lg]}>
        {/* XP Icon */}
        <View style={[styles.iconContainer, { backgroundColor: GamificationColors.xp }]}>
          <Icon
            name="star"
            fill={Palette.white}
            style={styles.icon}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.amount, { color: GamificationColors.xp }]}>
            +{amount} XP
          </Text>
          {reason && (
            <Text style={[styles.reason, { color: colors.textSecondary }]}>
              {reason}
            </Text>
          )}
        </View>

        {/* Decorative particles */}
        <View style={styles.particles}>
          {[...Array(5)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.particle,
                {
                  backgroundColor: GamificationColors.confettiColors[i % GamificationColors.confettiColors.length],
                  transform: [
                    { rotate: `${i * 72}deg` },
                    { translateY: -20 },
                  ],
                },
              ]}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  icon: {
    width: 20,
    height: 20,
  },
  content: {
    flex: 1,
  },
  amount: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.lg,
  },
  reason: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  particles: {
    position: 'absolute',
    right: Spacing.lg,
    top: '50%',
    marginTop: -10,
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

export default XPGainToast;
