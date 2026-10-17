import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

/**
 * Bottom padding for a tab screen's scroll content: the floating tab bar's measured
 * height (it reports it, see CustomTabBar) plus a gap, so the last item is never
 * hidden behind the bar. Before the first measurement, an estimate from the safe area.
 */
export function useTabBarInset(): number {
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();
  return (tabBarHeight ?? Math.max(insets.bottom, Spacing.sm) + 72) + Spacing.lg;
}
