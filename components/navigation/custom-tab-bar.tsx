/**
 * CustomTabBar - Floating tab bar with glassmorphism and animations
 */

import React, { useContext, useEffect } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightCallbackContext, BottomTabBarProps } from 'expo-router/js-tabs';
import { Colors, BorderRadius, Shadows, Spacing, InterFonts, Palette } from '@/constants/theme';
import { SpringConfig, AnimationDuration } from '@/constants/animations';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Icon } from '@/components/icon';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/stores';

interface TabIconConfig {
  name: string;
  focusedName: string;
}

const TAB_ICONS: Record<string, TabIconConfig> = {
  index: { name: 'home-outline', focusedName: 'home' },
  todos: { name: 'checkmark-square-2-outline', focusedName: 'checkmark-square-2' },
  pomodoro: { name: 'clock-outline', focusedName: 'clock' },
  stats: { name: 'bar-chart-outline', focusedName: 'bar-chart' },
  settings: { name: 'settings-2-outline', focusedName: 'settings-2' },
};

interface TabItemProps {
  routeName: string;
  /** The translated tab title, read by screen readers (the bar shows icons only). */
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  color: string;
  activeColor: string;
  badge?: number;
}

function TabItem({
  routeName,
  label,
  isFocused,
  onPress,
  onLongPress,
  color,
  activeColor,
  badge,
}: TabItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const hapticEnabled = useSettingsStore((state) => state.settings.hapticFeedbackEnabled);

  const scale = useSharedValue(1);
  const indicatorWidth = useSharedValue(isFocused ? 48 : 0);
  const indicatorOpacity = useSharedValue(isFocused ? 1 : 0);
  const iconScaleValue = useSharedValue(isFocused ? 1.1 : 1);
  const iconConfig = TAB_ICONS[routeName];

  useEffect(() => {
    indicatorWidth.value = withTiming(isFocused ? 48 : 0, { duration: AnimationDuration.normal });
    indicatorOpacity.value = withTiming(isFocused ? 1 : 0, { duration: AnimationDuration.normal });
    iconScaleValue.value = withSpring(isFocused ? 1.1 : 1, SpringConfig.default);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Reanimated shared values are stable refs
  }, [isFocused]);

  const handlePressIn = () => {
    scale.value = withSpring(0.9, SpringConfig.snappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SpringConfig.default);
  };

  const handlePress = () => {
    if (hapticEnabled && (Platform.OS === 'ios' || Platform.OS === 'android')) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorWidth.value,
    opacity: indicatorOpacity.value,
  }));

  const iconScale = useAnimatedStyle(() => ({
    transform: [{ scale: iconScaleValue.value }],
  }));

  if (!iconConfig) return null;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItem}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
    >
      <Animated.View style={[styles.tabItemInner, animatedStyle]}>
        {/* Active indicator pill */}
        <Animated.View
          style={[
            styles.activeIndicator,
            { backgroundColor: activeColor + '20' },
            indicatorStyle,
          ]}
        />

        {/* Icon */}
        <Animated.View style={iconScale}>
          <Icon
            name={isFocused ? iconConfig.focusedName : iconConfig.name}
            fill={isFocused ? activeColor : color}
            style={styles.icon}
          />
        </Animated.View>

        {/* Badge */}
        {badge !== undefined && badge > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Animated.Text style={styles.badgeText}>
              {badge > 99 ? '99+' : badge}
            </Animated.Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function CustomTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const isDark = colorScheme === 'dark';
  // The bar floats over the screens; report its real height so screens can inset content.
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);

  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
    >
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: isDark ? 'rgba(59, 73, 83, 0.85)' : 'rgba(255, 255, 255, 0.85)',
          },
          Shadows.lg,
        ]}
      >
        {/* Blur background for glassmorphism effect */}
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={80}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(59, 73, 83, 0.95)' : 'rgba(255, 255, 255, 0.95)' },
            ]}
          />
        )}

        {/* Tab items */}
        <View style={styles.tabItems} accessibilityRole="tablist">
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = emitter.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigateToTab(route.key);
              }
            };

            const onLongPress = () => {
              emitter.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <TabItem
                key={route.key}
                routeName={route.name}
                label={options.title ?? route.name}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                color={colors.tabIconDefault}
                activeColor={colors.tabIconSelected}
                badge={options.tabBarBadge as number | undefined}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: BorderRadius.xxl,
    overflow: 'hidden',
    borderWidth: Platform.OS === 'android' ? 0 : 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabItems: {
    flexDirection: 'row',
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xl,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    height: '100%',
    borderRadius: BorderRadius.xl,
  },
  icon: {
    width: 24,
    height: 24,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: InterFonts.semibold,
    fontSize: 10,
    color: Palette.white,
  },
});

export default CustomTabBar;
