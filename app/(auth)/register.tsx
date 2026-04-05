import { Icon } from '@/components/icon';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/stores/auth-store';
import { validateDisplayName, validateEmail, validatePassword } from '@/utils/validators';
import { Input, Text } from '@ui-kitten/components';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { signUp, isLoading } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async () => {
    const nameError = validateDisplayName(displayName);
    if (nameError) { Alert.alert(t('common.error'), nameError); return; }
    const emailError = validateEmail(email);
    if (emailError) { Alert.alert(t('common.error'), emailError); return; }
    const passwordError = validatePassword(password);
    if (passwordError) { Alert.alert(t('common.error'), passwordError); return; }

    try {
      await signUp(email.trim(), password, displayName.trim());
      Alert.alert(t('auth.accountCreated'), t('auth.accountCreatedMsg'), [
        { text: t('common.ok'), onPress: () => router.replace('/(auth)/login' as any) },
      ]);
    } catch (e: unknown) {
      Alert.alert(t('auth.signUpFailed'), (e as Error).message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
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
            <Icon name="leaf-outline" fill="#fff" size={32} />
          </View>
          <Text category="h3" style={{ color: colors.text, marginTop: Spacing.md }}>
            {t('auth.joinTitle')}
          </Text>
          <Text category="s1" style={{ color: colors.textSecondary, marginTop: Spacing.xs }}>
            {t('auth.joinSubtitle')}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).duration(600)} style={styles.form}>
          <Input
            label={t('auth.name')}
            placeholder={t('auth.namePlaceholder')}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoComplete="name"
            style={[styles.input, { backgroundColor: colors.card }]}
            textStyle={{ color: colors.text }}
          />
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
            autoComplete="new-password"
            style={[styles.input, { backgroundColor: colors.card }]}
            textStyle={{ color: colors.text }}
          />

          <Pressable
            onPress={handleSignUp}
            disabled={isLoading}
            style={[
              styles.button,
              { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text category="s1" style={{ color: '#fff' }}>{t('auth.createAccount')}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(auth)/login' as any)}
            style={styles.linkButton}
          >
            <Text category="c1" style={{ color: colors.primary }}>
              {t('auth.hasAccount')}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
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
