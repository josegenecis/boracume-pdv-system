import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../config/theme';
import { useAuthSession } from '../contexts/AuthSessionContext';

export function LoginScreen() {
  const { signIn } = useAuthSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    try {
      setLoading(true);
      setError('');
      await signIn(email.trim(), password);
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <Text style={styles.badge}>BoraCumê Garçom</Text>
          <Text style={styles.title}>Operação de mesas, contas e comandas no celular</Text>
          <Text style={styles.subtitle}>
            Entre com e-mail e senha para acessar o mapa de mesas em tempo real.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="garcom@boracume.com"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Digite sua senha"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, (!email || !password || loading) && styles.buttonDisabled]}
            disabled={!email || !password || loading}
            onPress={handleSubmit}
          >
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Entrar</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  keyboard: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
  },
  hero: {
    gap: spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFE9DB',
    color: colors.brandDark,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontWeight: '800',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    color: colors.ink,
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.ink,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontSize: 16,
  },
  error: {
    color: colors.danger,
    fontWeight: '600',
  },
  button: {
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
});
