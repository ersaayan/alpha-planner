import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function EmptyState({ icon, title, subtitle, action, style }: EmptyStateProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, style]}>
      {icon && (
        <Icon name={icon} fill={colors.textMuted} size={48} style={styles.icon} />
      )}
      <Text category="s1" style={{ color: colors.textMuted, textAlign: 'center' }}>
        {title}
      </Text>
      {subtitle && (
        <Text category="c1" style={{ color: colors.textMuted, textAlign: 'center', marginTop: Spacing.xs }}>
          {subtitle}
        </Text>
      )}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  icon: {
    marginBottom: Spacing.md,
  },
  action: {
    marginTop: Spacing.md,
  },
});
