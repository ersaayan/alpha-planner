import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from '@ui-kitten/components';
import { Spacing } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function SectionHeader({ title, action, style }: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <Text category="h6" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  title: {
    flexShrink: 1,
  },
});
