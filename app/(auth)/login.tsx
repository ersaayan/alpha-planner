import { Icon } from '@/components/icon';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/stores/auth-store';
import { validateEmail, validatePassword } from '@/utils/validators';
import { Input, Text } from '@ui-kitten/components';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { signIn, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async () => {
    const emailError = validateEmail(email);
    if (emailError) { Alert.alert('Error', emailError); return; }
    const passwordError = validatePassword(password);
    if (passwordError) { Alert.alert('Error', passwordError); return; }

    try {
      await signIn(email.trim(), password);
    } catch (e: unknown) {
      Alert.alert('Sign In Failed', (e as Error).message);
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
            Alpha Planner
          </Text>
          <Text category="s1" style={{ color: colors.textSecondary, marginTop: Spacing.xs }}>
            Sign in to continue
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).duration(600)} style={styles.form}>
          <Input
            label="Email"
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={[styles.input, { backgroundColor: colors.card }]}
            textStyle={{ color: colors.text }}
          />
          <Input
            label="Password"
            placeholder="••••••••"
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
            style={[
              styles.button,
              { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text category="s1" style={{ color: '#fff' }}>Sign In</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(auth)/register')}
            style={styles.linkButton}
          >
            <Text category="c1" style={{ color: colors.primary }}>
              Don't have an account? Create one
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
