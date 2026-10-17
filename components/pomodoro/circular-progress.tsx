import { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { GamificationColors, Shadows } from '@/constants/theme';
import { useAmbientMotion } from '@/hooks/use-ambient-motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedView = Animated.View;

interface CircularProgressProps {
  size: number;
  strokeWidth: number;
  progress: number; // 0 to 1
  progressColor: string;
  backgroundColor: string;
  secondaryColor?: string; // For gradient end color
  showGlow?: boolean;
  isRunning?: boolean;
  children?: React.ReactNode;
}

export function CircularProgress({
  size,
  strokeWidth,
  progress,
  progressColor,
  backgroundColor,
  secondaryColor,
  showGlow = false,
  isRunning = false,
  children,
}: CircularProgressProps) {
  const instanceId = useId();
  const gradientId = `progressGradient-${instanceId}`;

  const animatedProgress = useSharedValue(0);
  const pulse = useAmbientMotion(isRunning);
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(showGlow ? 0.3 : 0);

  // Calculate circle properties
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Gradient colors
  const gradientStart = progressColor;
  const gradientEnd = secondaryColor || GamificationColors.progressEnd;

  useEffect(() => {
    animatedProgress.value = withTiming(progress, {
      duration: 500,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Reanimated shared values are stable refs
  }, [progress]);

  // Pulse animation when timer is running (not with Reduce Motion)
  useEffect(() => {
    if (pulse) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1500 }),
          withTiming(0.2, { duration: 1500 })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 300 });
      glowOpacity.value = withTiming(showGlow ? 0.3 : 0, { duration: 300 });
    }
    return () => {
      cancelAnimation(pulseScale);
      cancelAnimation(glowOpacity);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Reanimated shared values are stable refs
  }, [pulse, showGlow]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference * (1 - animatedProgress.value);
    return {
      strokeDashoffset,
      // A round cap still draws a dot at 0%: hide the arc until there is progress.
      strokeOpacity: animatedProgress.value > 0.001 ? 1 : 0,
    };
  });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    shadowOpacity: glowOpacity.value,
  }));

  return (
    <AnimatedView style={[styles.container, { width: size, height: size }, containerStyle]}>
      {/* Outer glow effect */}
      {(showGlow || isRunning) && (
        <AnimatedView
          style={[
            styles.glow,
            {
              width: size + 40,
              height: size + 40,
              borderRadius: (size + 40) / 2,
              top: -20,
              left: -20,
              backgroundColor: progressColor,
            },
            glowStyle,
          ]}
        />
      )}

      <Svg width={size} height={size}>
        <Defs>
          {/* Define gradient for progress arc */}
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradientStart} stopOpacity="1" />
            <Stop offset="100%" stopColor={gradientEnd} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Rotate the group to start from top (an SVG transform string: no web-only
            transform-origin attribute warning) */}
        <G transform={`rotate(-90 ${center} ${center})`}>
          {/* Background circle */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle with gradient */}
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
            strokeLinecap="round"
          />
        </G>
      </Svg>

      {/* Center content */}
      <View style={[styles.content, { width: size, height: size }]}>
        {children}
      </View>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    ...Shadows.lg,
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
