import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSignup() {
    setError(null);
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email.trim(), password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Quase lá</Text>
          <Text style={styles.subtitle}>
            Enviamos um e-mail de confirmação — confirma pra poder entrar.
          </Text>
          <Button label="Ir pro login" onPress={() => router.replace('/(auth)/login')} style={{ marginTop: spacing.xl }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <Text style={styles.title}>Vamos começar</Text>
        <Text style={styles.subtitle}>Cria sua conta pra cadastrar seu bebê em seguida</Text>

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
            placeholder="mínimo 6 caracteres"
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button label="Criar conta" onPress={handleSignup} loading={loading} style={{ marginTop: spacing.sm }} />
        </View>

        <Link href="/(auth)/login" style={styles.link}>
          <Text style={styles.linkText}>Já tem conta? Entrar</Text>
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
