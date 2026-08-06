import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { erroDeSenhaLocal, SENHA_MINIMA } from '../../src/lib/mensagens-auth';
import { colors, spacing, typography } from '../../src/theme/tokens';

/**
 * Onde o link do e-mail devolve a mãe.
 *
 * O link traz uma sessão de recuperação — ela chega aqui já autenticada, e é
 * justamente por isso que o RootNavigator precisa segurá-la aqui (`emRecuperacao`):
 * sem isso ele veria "tem sessão" e mandaria pra Home, com a senha antiga ainda
 * valendo e sem ela entender o que aconteceu.
 */
export default function NovaSenhaScreen() {
  const { session, definirNovaSenha, sairDaRecuperacao } = useAuth();
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function voltarProLogin() {
    sairDaRecuperacao();
    router.replace('/(auth)/login');
  }

  // Sem sessão aqui = o link expirou, já foi usado, ou foi aberto num navegador
  // diferente do que pediu o reset. São causas distintas com a mesma saída: pedir
  // outro link. Enumerar as causas não ajudaria ela a fazer nada diferente.
  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Esse link não vale mais</Text>
          <Text style={styles.subtitle}>
            Links de recuperação valem por pouco tempo e só podem ser usados uma vez. Pede outro
            que a gente manda na hora.
          </Text>

          <Button
            label="Pedir um link novo"
            onPress={() => {
              sairDaRecuperacao();
              router.replace('/(auth)/recuperar-senha');
            }}
            style={{ marginTop: spacing.xl }}
          />
          <Button
            label="Voltar pro login"
            variant="secondary"
            onPress={voltarProLogin}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </SafeAreaView>
    );
  }

  async function handleSalvar() {
    setError(null);

    const erroLocal = erroDeSenhaLocal(senha);
    if (erroLocal) {
      setError(erroLocal);
      return;
    }

    setLoading(true);
    const { error } = await definirNovaSenha(senha);
    setLoading(false);

    if (error) {
      setError(error);
      return;
    }

    // Sem tela de "pronto!": `definirNovaSenha` já baixou o `emRecuperacao`, e o
    // RootNavigator leva ela pro lugar de sempre. Ela pediu pra voltar a usar o
    // app, não pra ler um aviso.
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <Text style={styles.title}>Criar uma senha nova</Text>
        <Text style={styles.subtitle}>
          Escolhe uma senha nova pra sua conta. Assim que salvar, você já entra direto.
        </Text>

        <View style={{ marginTop: spacing.xl }}>
          <TextField
            label="Nova senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            placeholder={`mínimo ${SENHA_MINIMA} caracteres`}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button
            label="Salvar e entrar"
            onPress={handleSalvar}
            loading={loading}
            style={{ marginTop: spacing.sm }}
          />
        </View>
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
});
