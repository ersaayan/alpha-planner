import { StyleSheet, View } from 'react-native';
import { Text, Button } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      {/* Logo Area */}
      <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.logoArea}>
        <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
          <Icon name="leaf-outline" fill="#fff" style={styles.logoIcon} />
        </View>
        <Text category="h3" style={[styles.title, { color: colors.text }]}>
          Alpha Planner
        </Text>
        <Text category="s1" style={[styles.subtitle, { color: colors.textSecondary }]}>
          Focus. Plan. Grow.
        </Text>
      </Animated.View>

      {/* Features */}
      <Animated.View entering={FadeInUp.delay(400).duration(800)} style={styles.featuresArea}>
        <View style={styles.feature}>
          <View style={[styles.featureIcon, { backgroundColor: colors.primary + '20' }]}>
            <Icon name="clock-outline" fill={colors.primary} style={styles.icon} />
          </View>
          <View style={styles.featureText}>
            <Text category="s1">Pomodoro Timer</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              Stay focused with timed work sessions
            </Text>
          </View>
        </View>

        <View style={styles.feature}>
          <View style={[styles.featureIcon, { backgroundColor: colors.primary + '20' }]}>
            <Icon name="checkmark-square-2-outline" fill={colors.primary} style={styles.icon} />
          </View>
          <View style={styles.featureText}>
            <Text category="s1">Smart Tasks</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              Organize with categories and subtasks
            </Text>
          </View>
        </View>

        <View style={styles.feature}>
          <View style={[styles.featureIcon, { backgroundColor: colors.primary + '20' }]}>
            <Icon name="award-outline" fill={colors.primary} style={styles.icon} />
          </View>
          <View style={styles.featureText}>
            <Text category="s1">Achievements</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              Earn XP and unlock badges as you grow
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* CTA */}
      <Animated.View entering={FadeInUp.delay(600).duration(800)} style={styles.ctaArea}>
        <Button
          size="giant"
          style={styles.ctaButton}
          onPress={() => router.push('/(onboarding)/pomodoro-setup')}
        >
          Get Started
        </Button>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  logoArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoIcon: {
    width: 48,
    height: 48,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
  },
  featuresArea: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 28,
    height: 28,
  },
  featureText: {
    flex: 1,
  },
  ctaArea: {
    paddingVertical: Spacing.lg,
  },
  ctaButton: {
    borderRadius: BorderRadius.xl,
  },
});
