/**
 * AnimatedProgressBar - XP bar with shimmer effect and gradient fill
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { GamificationColors, Palette } from '@/constants/theme';
import { AnimationEasing, AnimationDuration } from '@/constants/animations';
import { useAmbientMotion } from '@/hooks/use-ambient-motion';

interface AnimatedProgressBarProps {
  progress: number; // 0 to 1
  height?: number;
  showShimmer?: boolean;
  gradientColors?: [string, string];
  backgroundColor?: string;
  style?: ViewStyle;
}

export function AnimatedProgressBar({
  progress,
  height = 12,
  showShimmer = true,
  gradientColors = [GamificationColors.progressStart, GamificationColors.progressEnd],
  backgroundColor = 'rgba(144, 171, 139, 0.2)',
  style,
}: AnimatedProgressBarProps) {
  const animatedProgress = useSharedValue(0);
  const shimmerPosition = useSharedValue(-1);
  const shimmer = useAmbientMotion(showShimmer);

  // Animate progress when value changes
  useEffect(() => {
    animatedProgress.value = withTiming(progress, {
      duration: AnimationDuration.xpFill,
      easing: AnimationEasing.smooth,
    });
  }, [progress, animatedProgress]);

  // Continuous shimmer animation (not with Reduce Motion, not while the screen is hidden)
  useEffect(() => {
    if (shimmer && progress > 0) {
      shimmerPosition.value = withRepeat(
        withTiming(1, {
          duration: AnimationDuration.shimmer,
          easing: Easing.linear,
        }),
        -1, // Infinite repeat
        false // Don't reverse
      );
    }
    return () => {
      cancelAnimation(shimmerPosition);
      shimmerPosition.set(-1);
    };
  }, [shimmer, progress, shimmerPosition]);

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: `${animatedProgress.value * 100}%`,
    };
  });

  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerPosition.value,
      [-1, 1],
      [-100, 200]
    );

    return {
      transform: [{ translateX }],
      opacity: interpolate(
        shimmerPosition.value,
        [-1, -0.5, 0, 0.5, 1],
        [0, 0.3, 0.6, 0.3, 0]
      ),
    };
  });

  return (
    <View
      style={[styles.container, { height }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      {/* Background track */}
      <View style={[styles.track, { backgroundColor, borderRadius: height / 2 }]} />

      {/* Animated fill */}
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: height / 2 },
          progressStyle,
        ]}
      >
        <View style={[styles.gradient, { borderRadius: height / 2 }]}>
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: gradientColors[0],
                borderRadius: height / 2,
              },
            ]}
          />
          {/* Gradient overlay using opacity mask */}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: gradientColors[1],
                opacity: 0.5,
                borderRadius: height / 2,
              },
            ]}
          />
        </View>

        {/* Shimmer overlay */}
        {showShimmer && (
          <Animated.View style={[styles.shimmer, shimmerStyle]}>
            <View style={styles.shimmerGradient} />
          </Animated.View>
        )}
      </Animated.View>

      {/* Milestone markers */}
      <View style={styles.milestones}>
        {[0.25, 0.5, 0.75].map((milestone) => (
          <View
            key={milestone}
            style={[
              styles.milestone,
              {
                left: `${milestone * 100}%`,
                backgroundColor: progress >= milestone ? Palette.white : 'rgba(255,255,255,0.3)',
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  track: {
    ...StyleSheet.absoluteFill,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  gradient: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    overflow: 'hidden',
  },
  shimmerGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    transform: [{ skewX: '-20deg' }],
  },
  milestones: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  milestone: {
    position: 'absolute',
    width: 3,
    height: '60%',
    top: '20%',
    borderRadius: 1.5,
    marginLeft: -1.5,
  },
});

export default AnimatedProgressBar;
