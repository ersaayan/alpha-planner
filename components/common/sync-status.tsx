import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSyncStore } from '@/stores/sync-store';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function SyncStatus() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const lastError = useSyncStore((state) => state.lastError);
  const pendingCount = useSyncStore((state) => state.pendingOperations.length);

  // Only show when something is happening
  if (!isSyncing && !lastError && pendingCount === 0) return null;

  return (
    <View style={styles.container}>
      {isSyncing ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : lastError ? (
        <View style={[styles.dot, { backgroundColor: colors.error }]} />
      ) : pendingCount > 0 ? (
        <View style={[styles.dot, { backgroundColor: colors.warning }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
