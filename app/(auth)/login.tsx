import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      setError('E-mail ou senha incorretos.');
      return;
    }
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <Text style={styles.title}>Bem-vinda de volta</Text>
        <Text style={styles.subtitle}>Entra pra continuar acompanhando a rotina dela</Text>

        <View style={{ marginTop: spacing.xl }}>
          <TextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="seu@email.com"
          />
          <TextField
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button label="Entrar" onPress={handleLogin} loading={loading} style={{ marginTop: spacing.sm }} />
        </View>

        <Link href="/(auth)/signup" style={styles.link}>
          <Text style={styles.linkText}>Ainda não tem conta? Criar conta</Text>
        </Link>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutro50 },
  content: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  title: { ...typography.h1, color: colors.headline, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.neutro500 },
  errorText: { ...typography.caption, color: colors.coral600, marginBottom: spacing.sm },
  link: { marginTop: spacing.xl, alignSelf: 'center' },
  linkText: { ...typography.body, color: colors.rosa700, fontFamily: 'NunitoSans_600SemiBold' },
});
