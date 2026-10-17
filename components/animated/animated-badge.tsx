/**
 * AnimatedBadge - Level and achievement badges with animations
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import { Text } from '@ui-kitten/components';
import { Colors, GamificationColors, Shadows, InterFonts, FontSize } from '@/constants/theme';
import { SpringConfig } from '@/constants/animations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAmbientMotion } from '@/hooks/use-ambient-motion';
import { Icon } from '@/components/icon';

interface LevelBadgeProps {
  level: number;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  showGlow?: boolean;
  isLevelingUp?: boolean;
  style?: ViewStyle;
}

export function LevelBadge({
  level,
  title,
  size = 'md',
  showGlow = false,
  isLevelingUp = false,
  style,
}: LevelBadgeProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const scale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(showGlow ? 0.3 : 0);
  const pulseGlow = useAmbientMotion(showGlow);

  // Size configurations
  const sizeConfig = {
    sm: { container: 48, font: FontSize.lg, icon: 16 },
    md: { container: 72, font: FontSize.xxl, icon: 20 },
    lg: { container: 96, font: FontSize.xxxl, icon: 24 },
  };

  const config = sizeConfig[size];

  useEffect(() => {
    if (isLevelingUp) {
      // Level up celebration animation
      scale.value = withSequence(
        withTiming(0.8, { duration: 100 }),
        withSpring(1.3, SpringConfig.bouncy),
        withSpring(1, SpringConfig.default)
      );

      // Ring expand animation
      ringOpacity.value = withSequence(
        withTiming(0.8, { duration: 100 }),
        withDelay(600, withTiming(0, { duration: 400 }))
      );
      ringScale.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(2.5, { duration: 800 })
      );

      // Glow pulse
      glowOpacity.value = withSequence(
        withTiming(0.6, { duration: 200 }),
        withTiming(0.3, { duration: 600 })
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Reanimated shared values are stable refs
  }, [isLevelingUp]);

  useEffect(() => {
    if (pulseGlow) {
      glowOpacity.set(withRepeat(
        withSequence(
          withTiming(0.4, { duration: 1500 }),
          withTiming(0.2, { duration: 1500 })
        ),
        -1,
        true
      ));
    }
    return () => {
      cancelAnimation(glowOpacity);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Reanimated shared values are stable refs
  }, [pulseGlow]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={[styles.container, { width: config.container, height: config.container }, style]}>
      {/* Glow effect */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: config.container * 1.5,
            height: config.container * 1.5,
            borderRadius: config.container * 0.75,
            backgroundColor: GamificationColors.levelUp,
          },
          glowStyle,
        ]}
      />

      {/* Level up ring */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: config.container,
            height: config.container,
            borderRadius: config.container / 2,
            borderColor: GamificationColors.xp,
          },
          ringStyle,
        ]}
      />

      {/* Badge body */}
      <Animated.View
        style={[
          styles.badge,
          {
            width: config.container,
            height: config.container,
            borderRadius: config.container / 2,
            backgroundColor: colors.primary,
          },
          Shadows.md,
          badgeStyle,
        ]}
      >
        {/* Inner shadow effect */}
        <View
          style={[
            styles.innerShadow,
            {
              width: config.container - 8,
              height: config.container - 8,
              borderRadius: (config.container - 8) / 2,
            },
          ]}
        />

        {/* Level number */}
        <Text
          style={[
            styles.levelNumber,
            {
              fontSize: config.font,
              color: colors.onPrimary,
            },
          ]}
        >
          {level}
        </Text>
      </Animated.View>

      {/* Title below */}
      {title && (
        <Text
          style={[
            styles.title,
            { color: colors.text },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
      )}
    </View>
  );
}

interface AchievementBadgeProps {
  icon: string;
  title: string;
  isUnlocked: boolean;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

const ACHIEVEMENT_SIZES = {
  sm: { container: 56, icon: 24, border: 2 },
  md: { container: 72, icon: 32, border: 3 },
  lg: { container: 96, icon: 40, border: 4 },
};

const RARITY_RING = {
  common: GamificationColors.achievementBronze,
  rare: GamificationColors.achievementSilver,
  epic: GamificationColors.achievementGold,
  legendary: '#9B59B6',
};

/**
 * An achievement's medal and title. Static: the Stats screen shows all ~80 of them,
 * so it uses plain views (the unlock celebration is AchievementUnlock).
 */
export function AchievementBadge({ icon, title, isUnlocked, rarity = 'common', size = 'md', style }: AchievementBadgeProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const config = ACHIEVEMENT_SIZES[size];
  const ring = RARITY_RING[rarity];

  return (
    <View style={[styles.achievementContainer, style]}>
      <View
        style={[
          styles.achievementBadge,
          {
            width: config.container,
            height: config.container,
            borderRadius: config.container / 2,
            borderWidth: config.border,
            borderColor: isUnlocked ? ring : colors.border,
            backgroundColor: isUnlocked ? colors.card : colors.backgroundSecondary,
          },
          isUnlocked && Shadows.sm,
        ]}
      >
        <Icon
          name={isUnlocked ? icon : 'lock'}
          fill={isUnlocked ? ring : colors.textMuted}
          size={isUnlocked ? config.icon : config.icon * 0.6}
        />
      </View>

      <Text
        style={[styles.achievementTitle, { color: isUnlocked ? colors.text : colors.textMuted }]}
        numberOfLines={2}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    borderWidth: 3,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerShadow: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  levelNumber: {
    fontFamily: InterFonts.bold,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  title: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
    marginTop: 8,
    textAlign: 'center',
  },
  achievementContainer: {
    alignItems: 'center',
    width: 80,
  },
  achievementBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  achievementTitle: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.xs,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default LevelBadge;
