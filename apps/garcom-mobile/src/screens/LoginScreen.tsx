import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { formatCpf } from '../services/waiterApp';

const appMark = require('../../assets/app-garcom.png');
const wordmark = require('../../assets/logo-boracume.png');

export function LoginScreen() {
  const { signIn } = useAuthSession();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    try {
      setLoading(true);
      setError('');
      await signIn(cpf.trim(), password);
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
        <View style={styles.content}>
          <View style={styles.hero}>
            <View style={styles.heroGlowLarge} />
            <View style={styles.heroGlowSmall} />

            <View style={styles.appMarkWrap}>
              <Image source={appMark} style={styles.appMark} resizeMode="contain" />
            </View>

            <Image source={wordmark} style={styles.wordmark} resizeMode="contain" />

            <View style={styles.badge}>
              <Text style={styles.badgeText}>App Garcom</Text>
            </View>

            <Text style={styles.title}>Operacoes de mesas e comandas</Text>
            <Text style={styles.subtitle}>Entre com o CPF e a senha liberados em Configuracoes {'>'} Equipe.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>CPF</Text>
              <TextInput
                keyboardType="number-pad"
                value={cpf}
                onChangeText={(value) => setCpf(formatCpf(value))}
                placeholder="000.000.000-00"
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
              style={[styles.button, (!cpf || !password || loading) && styles.buttonDisabled]}
              disabled={!cpf || !password || loading}
              onPress={handleSubmit}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Entrar no App Garcom</Text>
              )}
            </Pressable>

            <Text style={styles.helper}>
              Se o acesso ainda nao estiver liberado, ative a permissao do app garcom no cadastro da
              equipe.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.xl,
    backgroundColor: colors.ink,
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroGlowLarge: {
    position: 'absolute',
    top: -30,
    right: -10,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(140, 200, 80, 0.16)',
  },
  heroGlowSmall: {
    position: 'absolute',
    bottom: 12,
    left: 6,
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: 'rgba(255, 100, 0, 0.14)',
  },
  appMarkWrap: {
    width: 156,
    height: 156,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.28)',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  appMark: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  wordmark: {
    width: '88%',
    height: 94,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  badgeText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: typography.caption,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: 'rgba(0, 0, 0, 0.28)',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
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
    shadowColor: colors.brand,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  helper: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 18,
    textAlign: 'center',
  },
});
