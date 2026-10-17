/**
 * LevelUpModal - Celebration modal for level advancement
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Modal, useWindowDimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { Text } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { Colors, GamificationColors, BorderRadius, Shadows, Spacing, InterFonts, FontSize } from '@/constants/theme';
import { SpringConfig, AnimationDuration } from '@/constants/animations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Icon } from '@/components/icon';
import { LevelBadge } from '@/components/animated/animated-badge';
import { AnimatedButton } from '@/components/animated/animated-button';

interface LevelUpModalProps {
  visible: boolean;
  newLevel: number;
  levelTitle: string;
  onClose: () => void;
}

export function LevelUpModal({
  visible,
  newLevel,
  levelTitle,
  onClose,
}: LevelUpModalProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

  const backdropOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.5);
  const modalOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const confettiRotation = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Backdrop fade in
      backdropOpacity.value = withTiming(1, { duration: AnimationDuration.medium });

      // Modal entrance
      modalScale.value = withSequence(
        withSpring(1.1, SpringConfig.wobbly),
        withSpring(1, SpringConfig.default)
      );
      modalOpacity.value = withTiming(1, { duration: AnimationDuration.fast });

      // Title slide up
      titleTranslateY.value = withDelay(
        300,
        withSpring(0, SpringConfig.bouncy)
      );

      // Confetti rotation
      confettiRotation.value = withRepeat(
        withTiming(360, { duration: 3000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      // Reset animations
      backdropOpacity.value = 0;
      modalScale.value = 0.5;
      modalOpacity.value = 0;
      titleTranslateY.value = 30;
      confettiRotation.value = 0;
    }
    return () => {
      cancelAnimation(confettiRotation);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Reanimated shared values are stable refs
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: modalScale.value }],
    opacity: modalOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: titleTranslateY.value }],
    opacity: modalOpacity.value,
  }));

  const confettiStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${confettiRotation.value}deg` }],
  }));

  const handleClose = () => {
    backdropOpacity.set(withTiming(0, { duration: AnimationDuration.fast }));
    modalScale.set(withTiming(0.8, { duration: AnimationDuration.fast }));
    modalOpacity.set(withTiming(0, { duration: AnimationDuration.fast }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    }));
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Confetti particles */}
        <Animated.View style={[styles.confettiContainer, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }, confettiStyle]}>
          {GamificationColors.confettiColors.map((color, i) =>
            [...Array(6)].map((_, j) => (
              <View
                key={`${i}-${j}`}
                style={[
                  styles.confetti,
                  {
                    backgroundColor: color,
                    transform: [
                      { rotate: `${(i * 5 + j) * 12}deg` },
                      { translateY: -150 - j * 30 },
                    ],
                  },
                ]}
              />
            ))
          )}
        </Animated.View>

        {/* Modal content */}
        <Animated.View
          style={[
            styles.modal,
            { backgroundColor: colors.card },
            Shadows.xl,
            modalStyle,
          ]}
          accessibilityViewIsModal={true}
          accessibilityLabel={t('gamification.levelUpA11y', { level: newLevel, title: levelTitle })}
        >
          {/* Glow ring */}
          <View style={styles.glowRing} />

          {/* Stars decoration */}
          <View style={styles.starsContainer}>
            {[0, 1, 2].map((i) => (
              <Icon
                key={i}
                name="star"
                fill={GamificationColors.xp}
                style={[
                  styles.star,
                  {
                    transform: [
                      { translateX: (i - 1) * 50 },
                      { translateY: i === 1 ? -10 : 0 },
                      { scale: i === 1 ? 1.2 : 0.8 },
                    ],
                  },
                ]}
              />
            ))}
          </View>

          {/* Level badge */}
          <View style={styles.badgeContainer}>
            <LevelBadge
              level={newLevel}
              size="lg"
              showGlow={true}
              isLevelingUp={true}
            />
          </View>

          {/* Title */}
          <Animated.View style={titleStyle}>
            <Text style={[styles.congratsText, { color: colors.textSecondary }]}>
              {t('gamification.congratulations')}
            </Text>
            <Text style={[styles.levelUpText, { color: GamificationColors.xp }]}>
              {t('gamification.levelUp')}
            </Text>
            <Text style={[styles.levelTitle, { color: colors.text }]}>
              {levelTitle}
            </Text>
          </Animated.View>

          {/* Description */}
          <Text style={[styles.description, { color: colors.textMuted }]}>
            {t('gamification.levelUpBody', { level: newLevel })}
          </Text>

          {/* Continue button */}
          <AnimatedButton
            title={t('common.continue')}
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleClose}
            style={styles.continueButton}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  confettiContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confetti: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    overflow: 'hidden',
  },
  glowRing: {
    position: 'absolute',
    top: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: GamificationColors.levelUp,
    opacity: 0.1,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  star: {
    width: 32,
    height: 32,
  },
  badgeContainer: {
    marginVertical: Spacing.lg,
  },
  congratsText: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.md,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  levelUpText: {
    fontFamily: InterFonts.extrabold,
    fontSize: FontSize.xxxl,
    textAlign: 'center',
    marginTop: Spacing.xs,
    letterSpacing: 2,
  },
  levelTitle: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.xl,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  description: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.lg,
    lineHeight: FontSize.sm * 1.5,
  },
  continueButton: {
    marginTop: Spacing.xl,
  },
});

export default LevelUpModal;
