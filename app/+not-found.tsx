import { Text } from '@ui-kitten/components';
import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('notFound.title') }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text category="h5" style={{ color: colors.text }}>
          {t('notFound.title')}
        </Text>
        <Text category="p1" style={[styles.message, { color: colors.textSecondary }]}>
          {t('notFound.message')}
        </Text>
        <Link href="/" replace style={[styles.link, { color: colors.primary }]}>
          {t('notFound.goHome')}
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  message: {
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  link: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    fontWeight: '600',
  },
});
