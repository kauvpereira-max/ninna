import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { canalDeProblemaConfigurado, urlRelatarProblema } from '../../src/lib/contato';
import { colors, spacing, radius, typography } from '../../src/theme/tokens';

export default function MaisScreen() {
  const { user, nomeMae, signOut } = useAuth();
  const router = useRouter();

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

        <View style={styles.lista}>
          <Item
            icone="sparkles-outline"
            label="Plano da Ninna"
            descricao="Assinatura, cartão e faturas"
            onPress={() => router.push('/assinatura')}
          />

          <Item
            icone="heart-outline"
            label="Sobre a Ninna"
            descricao="O que fica guardado, e como apagar tudo"
            onPress={() => router.push('/sobre')}
          />

          {/* Some quando o número não está preenchido — ver src/lib/contato.ts.
              Item que abre tela de erro do navegador ensina a mãe que não existe
              canal, e é o R6 acontecendo em silêncio. */}
          {canalDeProblemaConfigurado() ? (
            <Item
              icone="chatbubble-ellipses-outline"
              label="Relatar problema"
              descricao="Abre o WhatsApp com a mensagem começada"
              onPress={() => Linking.openURL(urlRelatarProblema())}
            />
          ) : null}

          {/* Por último e separado do resto: é a única ação da lista que tira a mãe
              de onde ela está, e no iPhone instalado voltar custa e-mail e senha. */}
          <Item
            icone="log-out-outline"
            label="Sair da conta"
            onPress={signOut}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Item({
  icone,
  label,
  descricao,
  onPress,
  style,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  label: string;
  descricao?: string;
  onPress: () => void;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={descricao ? `${label}. ${descricao}` : label}
      style={[styles.item, style]}
    >
      <View style={styles.itemIcone}>
        <Ionicons name={icone} size={20} color={colors.rosa700} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemLabel}>{label}</Text>
        {descricao ? <Text style={styles.itemDescricao}>{descricao}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.neutro300} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutro50 },
  // Mesma coluna de 480 da Home: sem isso a web estica o cartão de ponta a ponta.
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
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
  lista: { marginTop: spacing.xl, gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  itemIcone: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.rosa100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: { ...typography.bodyLarge, color: colors.headline },
  itemDescricao: { ...typography.caption, color: colors.neutro500, marginTop: 2 },
});
