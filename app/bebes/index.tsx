import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBaby } from '../../src/contexts/BabyContext';
import { formatarIdade } from '../../src/lib/idade';
import { colors, spacing, radius, typography, elevation } from '../../src/theme/tokens';

export default function SeletorBebeScreen() {
  const { bebes, bebeAtivo, selecionarBebe } = useBaby();
  const router = useRouter();

  function fechar() {
    // Na web a rota modal pode ser aberta direto pela URL, sem histórico pra voltar.
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }

  function escolher(id: string) {
    if (id !== bebeAtivo?.id) selecionarBebe(id);
    fechar();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>Trocar de bebê</Text>
            <Text style={styles.subtitulo}>Quem você quer acompanhar agora?</Text>
          </View>
          <Pressable
            onPress={fechar}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            style={styles.fechar}
          >
            <Ionicons name="close" size={22} color={colors.neutro500} />
          </Pressable>
        </View>

        <View style={styles.lista}>
          {bebes.map((bebe) => {
            const ativo = bebe.id === bebeAtivo?.id;
            return (
              <Pressable
                key={bebe.id}
                onPress={() => escolher(bebe.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
                accessibilityLabel={
                  ativo
                    ? `${bebe.name}, em acompanhamento agora`
                    : `Acompanhar ${bebe.name}`
                }
                style={[styles.item, ativo && styles.itemAtivo]}
              >
                <View style={[styles.avatar, ativo && styles.avatarAtivo]}>
                  <Text style={styles.avatarLetra}>{bebe.name.charAt(0).toUpperCase()}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.nome, ativo && styles.nomeAtivo]}>{bebe.name}</Text>
                  <Text style={styles.idade}>{formatarIdade(bebe.birth_date)}</Text>
                </View>

                {ativo ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.rosa500} />
                ) : null}
              </Pressable>
            );
          })}

          <Pressable
            // Replace, não push: o seletor deu lugar ao cadastro, não faz sentido
            // voltar pra uma lista que vai mudar de qualquer jeito.
            onPress={() => router.replace('/bebes/novo')}
            accessibilityRole="button"
            accessibilityLabel="Cadastrar outro bebê"
            style={styles.item}
          >
            <View style={styles.avatarNovo}>
              <Ionicons name="add" size={20} color={colors.rosa700} />
            </View>
            <Text style={styles.novoLabel}>Cadastrar outro bebê</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.superficie },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titulo: { ...typography.h1, color: colors.headline, marginBottom: spacing.xs },
  subtitulo: { ...typography.body, color: colors.neutro500 },
  fechar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutro100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lista: { marginTop: spacing.xl, gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: spacing.md,
    ...elevation.level1,
  },
  itemAtivo: { borderColor: colors.rosa500, backgroundColor: colors.rosa50 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.amarelo200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAtivo: { backgroundColor: colors.rosa200 },
  avatarLetra: { ...typography.h3, color: colors.headline },
  nome: { ...typography.bodyLarge, color: colors.headline, fontFamily: 'NunitoSans_600SemiBold' },
  nomeAtivo: { color: colors.rosa700 },
  idade: { ...typography.caption, color: colors.neutro500 },
  avatarNovo: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.rosa200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  novoLabel: { ...typography.body, color: colors.rosa700, fontFamily: 'NunitoSans_600SemiBold' },
});
