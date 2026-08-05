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
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);

  async function handleSignup() {
    setError(null);

    // Ordem das validações = ordem dos campos na tela. Mandar a mãe olhar pra cima
    // pro erro que ela nem chegou a cometer ainda é ruído.
    if (nome.trim().length < 2) {
      setError('Conta pra gente como você quer ser chamada.');
      return;
    }
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    const { error, precisaConfirmarEmail } = await signUp(email.trim(), password, nome);
    setLoading(false);

    if (error) {
      setError(error);
      return;
    }

    // Com confirmação desligada (config do beta) veio sessão junto, e o RootNavigator
    // já está levando a mãe pro cadastro do bebê — não há nada a fazer aqui, e forçar
    // uma tela de "pronto!" no meio só atrasaria ela.
    if (precisaConfirmarEmail) setAguardandoConfirmacao(true);
  }

  if (aguardandoConfirmacao) {
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
          {/* Primeiro campo da conta é o nome, não o e-mail: a primeira coisa que a
              Ninna pergunta é como chamar a mãe, não como identificá-la. */}
          <TextField
            label="Como você quer ser chamada?"
            value={nome}
            onChangeText={setNome}
            autoCapitalize="words"
            placeholder="seu nome ou apelido"
          />
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
