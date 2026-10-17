import { Icon } from '@/components/icon';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCloseAuth, useFinishSignIn } from '@/hooks/use-finish-sign-in';
import { getAuthErrorKey } from '@/services/supabase/auth-errors';
import { useAuthStore } from '@/stores/auth-store';
import { validateEmail, validatePassword } from '@/utils/validators';
import { Input, Text } from '@ui-kitten/components';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const signIn = useAuthStore((state) => state.signIn);
  const isLoading = useAuthStore((state) => state.isLoading);
  const finishSignIn = useFinishSignIn();
  const closeAuth = useCloseAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();
    const emailError = validateEmail(trimmedEmail);
    if (emailError) { Alert.alert(t('common.error'), t(emailError)); return; }
    const passwordError = validatePassword(password);
    if (passwordError) { Alert.alert(t('common.error'), t(passwordError)); return; }

    let result;
    try {
      result = await signIn(trimmedEmail, password);
    } catch (e: unknown) {
      Alert.alert(t('auth.signInFailed'), t(getAuthErrorKey(e)));
      return;
    }
    finishSignIn(result);
  };

  return (
    <KeyboardAwareScrollView
      style={{ backgroundColor: colors.background }}
      bottomOffset={Spacing.lg}
      contentContainerStyle={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Spacing.xxxl,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.header}>
        <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
          <Icon name="leaf-outline" fill={colors.onPrimary} size={32} />
        </View>
        <Text category="h3" style={{ color: colors.text, marginTop: Spacing.md }}>
          {t('auth.signInTitle')}
        </Text>
        <Text category="s1" style={{ color: colors.textSecondary, marginTop: Spacing.xs }}>
          {t('auth.signInSubtitle')}
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400).duration(600)} style={styles.form}>
        <Input
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={[styles.input, { backgroundColor: colors.card }]}
          textStyle={{ color: colors.text }}
        />
        <Input
          label={t('auth.password')}
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          style={[styles.input, { backgroundColor: colors.card }]}
          textStyle={{ color: colors.text }}
        />

        <Pressable
          onPress={handleSignIn}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoading, busy: isLoading }}
          style={[
            styles.button,
            { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text category="s1" style={{ color: colors.onPrimary }}>{t('auth.signIn')}</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.replace('/(auth)/register' as any)}
          accessibilityRole="button"
          style={styles.linkButton}
        >
          <Text category="c1" style={{ color: colors.primary }}>
            {t('auth.noAccount')}
          </Text>
        </Pressable>

        <Pressable onPress={closeAuth} style={styles.linkButton} accessibilityRole="button">
          <Text category="c1" style={{ color: colors.textSecondary }}>
            {t('auth.notNow')}
          </Text>
        </Pressable>
      </Animated.View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    gap: Spacing.md,
  },
  input: {
    borderRadius: BorderRadius.md,
  },
  button: {
    height: 48,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
});
