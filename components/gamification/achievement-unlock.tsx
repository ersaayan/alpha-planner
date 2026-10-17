/**
 * AchievementUnlock - Achievement unlock celebration popup
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
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
import { useTranslation } from 'react-i18next';
import { Colors, GamificationColors, BorderRadius, Shadows, Spacing, InterFonts, FontSize } from '@/constants/theme';
import { SpringConfig, AnimationDuration } from '@/constants/animations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Icon } from '@/components/icon';

interface AchievementUnlockProps {
  visible: boolean;
  icon: string;
  title: string;
  description: string;
  xpReward?: number;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  onClose: () => void;
  autoDismiss?: boolean;
  autoDismissDelay?: number;
}

export function AchievementUnlock({
  visible,
  icon,
  title,
  description,
  xpReward = 100,
  rarity = 'common',
  onClose,
  autoDismiss = true,
  autoDismissDelay = 4000,
}: AchievementUnlockProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  const translateY = useSharedValue(200);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const badgeScale = useSharedValue(0);

  const rarityColors = {
    common: GamificationColors.achievementBronze,
    rare: GamificationColors.achievementSilver,
    epic: GamificationColors.achievementGold,
    legendary: '#9B59B6',
  };

  const { t } = useTranslation();
  const rarityLabels = {
    common: t('gamification.rarity.common'),
    rare: t('gamification.rarity.rare'),
    epic: t('gamification.rarity.epic'),
    legendary: t('gamification.rarity.legendary'),
  };

  useEffect(() => {
    if (visible) {
      // Badge pop in
      badgeScale.value = withDelay(
        200,
        withSequence(
          withSpring(1.2, SpringConfig.wobbly),
          withSpring(1, SpringConfig.default)
        )
      );
      scale.value = withSpring(1, SpringConfig.default);

      if (autoDismiss) {
        const hideDelay = autoDismissDelay - AnimationDuration.medium;
        // Use withSequence to avoid conflicting animations on translateY
        translateY.value = withSequence(
          withSpring(0, SpringConfig.bouncy),
          withDelay(
            hideDelay,
            withTiming(200, { duration: AnimationDuration.medium }, (finished) => {
              if (finished) {
                runOnJS(onClose)();
              }
            })
          )
        );
        opacity.value = withSequence(
          withTiming(1, { duration: AnimationDuration.fast }),
          withDelay(
            hideDelay,
            withTiming(0, { duration: AnimationDuration.medium })
          )
        );
      } else {
        // No auto dismiss - just animate in
        translateY.value = withSpring(0, SpringConfig.bouncy);
        opacity.value = withTiming(1, { duration: AnimationDuration.fast });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Reanimated shared values are stable refs
  }, [visible, autoDismiss, autoDismissDelay]);

  // The exit animation's callback does not fire on every platform (e.g. the web); a timer
  // makes sure the next celebration in the queue is shown.
  useEffect(() => {
    if (!visible || !autoDismiss) return;
    const timer = setTimeout(onClose, autoDismissDelay + 150);
    return () => clearTimeout(timer);
  }, [visible, autoDismiss, autoDismissDelay, onClose]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  if (!visible) return null;

  return (
    <Pressable
      style={styles.overlay}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityHint={t('common.tapToClose')}
      accessibilityLiveRegion="polite"
    >
      <Animated.View
        style={[
          styles.container,
          { backgroundColor: colors.card, width: SCREEN_WIDTH - Spacing.xl * 2 },
          Shadows.xl,
          containerStyle,
        ]}
      >
        {/* Decorative background */}
        <View style={[styles.glowBg, { backgroundColor: rarityColors[rarity] }]} />

        {/* Achievement unlocked header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Icon
            name="unlock"
            fill={rarityColors[rarity]}
            style={styles.unlockIcon}
          />
          <Text style={[styles.headerText, { color: rarityColors[rarity] }]}>
            {t('gamification.achievementUnlocked')}
          </Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Badge */}
          <Animated.View style={[styles.badgeContainer, badgeStyle]}>
            <View style={[styles.badgeGlow, { backgroundColor: rarityColors[rarity] }]} />
            <View style={[styles.badge, { borderColor: rarityColors[rarity] }]}>
              <Icon
                name={icon}
                fill={rarityColors[rarity]}
                style={styles.badgeIcon}
              />
            </View>
          </Animated.View>

          {/* Title and description */}
          <Text style={[styles.title, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {description}
          </Text>

          {/* Rarity and XP */}
          <View style={styles.rewardsRow}>
            <View style={[styles.rarityBadge, { backgroundColor: rarityColors[rarity] + '20' }]}>
              <Text style={[styles.rarityText, { color: rarityColors[rarity] }]}>
                {rarityLabels[rarity]}
              </Text>
            </View>
            <View style={[styles.xpBadge, { backgroundColor: GamificationColors.xp + '20' }]}>
              <Icon
                name="star"
                fill={GamificationColors.xp}
                style={styles.xpIcon}
              />
              <Text style={[styles.xpText, { color: GamificationColors.xp }]}>
                {t('gamification.xpEarned', { amount: xpReward })}
              </Text>
            </View>
          </View>
        </View>

        {/* Sparkles */}
        {[...Array(8)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.sparkle,
              {
                backgroundColor: GamificationColors.confettiColors[i % GamificationColors.confettiColors.length],
                transform: [
                  { rotate: `${i * 45}deg` },
                  { translateY: -100 },
                ],
              },
            ]}
          />
        ))}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 1000,
  },
  container: {
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  glowBg: {
    position: 'absolute',
    top: -50,
    left: '50%',
    marginLeft: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  unlockIcon: {
    width: 16,
    height: 16,
    marginRight: Spacing.sm,
  },
  headerText: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.xs,
    letterSpacing: 1,
  },
  content: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  badgeContainer: {
    marginBottom: Spacing.lg,
  },
  badgeGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 50,
    opacity: 0.3,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeIcon: {
    width: 36,
    height: 36,
  },
  title: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.lg,
    textAlign: 'center',
  },
  description: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: FontSize.sm * 1.5,
  },
  rewardsRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  rarityBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  rarityText: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xs,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  xpIcon: {
    width: 12,
    height: 12,
    marginRight: 4,
  },
  xpText: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xs,
  },
  sparkle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default AchievementUnlock;
