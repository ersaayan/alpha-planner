import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Text, useColorScheme as useSystemColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import i18n from '@/services/i18n/i18n-config';
import { useSettingsStore } from '@/stores/settings-store';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    if (this.state.retryCount >= 2) {
      Alert.alert(i18n.t('errors.unableToRecover'), i18n.t('errors.closeAndReopen'));
      return;
    }
    this.setState((prev) => ({ hasError: false, retryCount: prev.retryCount + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleReload} />;
    }

    return this.props.children;
  }
}

/**
 * The fallback screen. It sits outside the UI Kitten and navigation providers (they
 * may be what crashed), so it uses plain React Native views with the app's theme.
 */
function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const systemScheme = useSystemColorScheme();
  const themeSetting = useSettingsStore((state) => state.settings.theme);
  const scheme = themeSetting === 'light' || themeSetting === 'dark' ? themeSetting : systemScheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {i18n.t('errors.somethingWrong')}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{i18n.t('errors.unexpectedError')}</Text>
      <Pressable
        style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        onPress={onRetry}
        accessibilityRole="button"
      >
        <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{i18n.t('common.retry')}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
