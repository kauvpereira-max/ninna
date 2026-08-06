import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function RecuperarSenhaScreen() {
  const { enviarResetSenha } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleEnviar() {
    setError(null);

    if (!email.trim()) {
      setError('Escreve o e-mail da sua conta pra gente mandar o link.');
      return;
    }

    setLoading(true);
    const { error } = await enviarResetSenha(email.trim());
    setLoading(false);

    // Erro aqui NÃO é vazamento de enumeração: o Supabase responde sucesso
    // mesmo pra e-mail que não tem conta. Então o que sobra em `error` é falha
    // de verdade — rede caída, e-mail malformado, limite de envio estourado —, e
    // esconder isso atrás da tela de "enviamos" faria a mãe esperar pra sempre
    // um e-mail que nunca saiu. A proteção contra enumeração está no caminho de
    // sucesso, que é idêntico exista ou não a conta.
    if (error) {
      setError(error);
      return;
    }

    setEnviado(true);
  }

  if (enviado) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Olha o seu e-mail</Text>
          {/* Nunca dizer "a conta existe" nem "não existe": quem perguntasse aqui
              descobriria quais e-mails têm conta no Ninna, um por vez. */}
          <Text style={styles.subtitle}>
            Se existir uma conta com {email.trim()}, o link pra criar uma senha nova já está a
            caminho. Ele vale por pouco tempo — se demorar, dá uma olhada no spam.
          </Text>

          <Button
            label="Tentar outro e-mail"
            variant="secondary"
            onPress={() => {
              setEnviado(false);
              setError(null);
            }}
            style={{ marginTop: spacing.xl }}
          />

          <Link href="/(auth)/login" style={styles.link}>
            <Text style={styles.linkText}>Voltar pro login</Text>
          </Link>
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
        <Text style={styles.title}>Esqueceu a senha?</Text>
        <Text style={styles.subtitle}>
          Acontece. Escreve o e-mail da sua conta que a gente manda um link pra você criar outra.
        </Text>

        <View style={{ marginTop: spacing.xl }}>
          <TextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="seu@email.com"
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button
            label="Enviar link"
            onPress={handleEnviar}
            loading={loading}
            style={{ marginTop: spacing.sm }}
          />
        </View>

        <Link href="/(auth)/login" style={styles.link}>
          <Text style={styles.linkText}>Lembrei — voltar pro login</Text>
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
