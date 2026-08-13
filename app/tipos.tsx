import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIAS_FORA_DA_HOME } from '../src/theme/categorias';
import { colors, spacing, radius, typography } from '../src/theme/tokens';

/**
 * Os tipos que não cabem na Home.
 *
 * ------------------------------------------------------------------
 * POR QUE ESTA TELA EXISTE
 *
 * A Home tem uma seleção FIXA de atalhos, e a razão não é técnica: mãe cansada
 * precisa que o botão esteja onde estava ontem. Um grid que cresce até vinte
 * itens, ou que se reordena sozinho pelos mais usados, obriga a reler a tela
 * inteira às 3h da manhã com o bebê no colo — o que se ganha em toques se perde
 * em atenção.
 *
 * Então os tipos que ficam de fora precisavam de um lugar, e este é o lugar. Ela
 * nasceu junto com os quatro primeiros tipos de fora, e não antes: tela vazia
 * não ajuda ninguém.
 *
 * ------------------------------------------------------------------
 * ELA SE APAGA SOZINHA
 *
 * A lista vem de `CATEGORIAS_FORA_DA_HOME`, que é derivada. No dia em que todos
 * os tipos estiverem nos atalhos, ela fica vazia — e o botão que leva até aqui
 * some da Home pela mesma conta. Nenhuma das duas coisas precisa ser lembrada.
 */
export default function TiposScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topo}>
          <Text style={styles.titulo}>Mais tipos</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            hitSlop={12}
          >
            <Ionicons name="close" size={24} color={colors.neutro400} />
          </Pressable>
        </View>

        <Text style={styles.subtitulo}>
          Os atalhos da Home são os do dia a dia. O resto do que dá pra anotar
          está aqui.
        </Text>

        <View style={styles.lista}>
          {CATEGORIAS_FORA_DA_HOME.map((c) => (
            <Pressable
              key={c.key}
              // `replace` e não `push`: a tela de registro fecha voltando, e com
              // `push` ela voltaria para cá em vez da Home — a mãe salvaria um
              // passeio e cairia numa lista de tipos, sem entender por quê.
              onPress={() => router.replace(`/registro/${c.key}`)}
              accessibilityRole="button"
              accessibilityLabel={`Registrar ${c.label}`}
              style={styles.item}
            >
              <View style={[styles.badge, { backgroundColor: c.bg }]}>
                <Ionicons name={c.icon} size={20} color={c.tinta} />
              </View>
              <Text style={styles.itemLabel}>{c.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.neutro400} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.superficie },
  scroll: { padding: spacing.lg, width: '100%', maxWidth: 480, alignSelf: 'center' },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titulo: { ...typography.h2, color: colors.headline },
  subtitulo: { ...typography.body, color: colors.neutro500, marginBottom: spacing.lg },
  lista: { gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    padding: spacing.md,
    // 44px de alvo: dedo de mãe com bebê no colo, no meio da madrugada.
    minHeight: 44,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: { ...typography.bodyLarge, color: colors.headline, flex: 1 },
});
