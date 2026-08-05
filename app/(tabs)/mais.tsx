import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { Button } from '../../src/components/Button';
import { colors, spacing, radius, typography } from '../../src/theme/tokens';

export default function MaisScreen() {
  const { user, nomeMae, signOut } = useAuth();

  // Sem nome (conta anterior ao D2) o cartão mostra o e-mail como identidade, em vez
  // de um espaço vazio onde deveria estar a pessoa.
  const inicial = (nomeMae ?? user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Mais</Text>

        <View style={styles.conta}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{inicial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {nomeMae ? <Text style={styles.nome}>{nomeMae}</Text> : null}
            <Text style={nomeMae ? styles.email : styles.nome}>{user?.email}</Text>
          </View>
        </View>

        <Button
          label="Sair da conta"
          variant="secondary"
          onPress={signOut}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutro50 },
  // Mesma coluna de 480 da Home: sem isso a web estica o cartão de ponta a ponta.
  scroll: { padding: spacing.lg, width: '100%', maxWidth: 480, alignSelf: 'center' },
  title: { ...typography.h1, color: colors.headline, marginBottom: spacing.lg },
  conta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.rosa100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { ...typography.h3, color: colors.rosa700 },
  nome: { ...typography.bodyLarge, color: colors.headline },
  email: { ...typography.caption, color: colors.neutro500 },
});
