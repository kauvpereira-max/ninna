import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBaby } from '../../src/contexts/BabyContext';
import { useHistorico } from '../../src/hooks/useHistorico';
import { ItemRegistro } from '../../src/components/ItemRegistro';
import { formatarHora, rotularDia } from '../../src/lib/horario';
import { colors, spacing, radius, typography } from '../../src/theme/tokens';

export default function RotinaScreen() {
  const { bebeAtivo } = useBaby();
  const router = useRouter();
  const { grupos, carregando, carregandoMais, erro, temMais, carregarMais, recarregar } =
    useHistorico(bebeAtivo?.id ?? null);

  if (!bebeAtivo) return null;

  const vazio = grupos.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.titulo}>Rotina</Text>
        <Text style={styles.subtitulo}>Tudo que você registrou, dia a dia</Text>

        {/*
          Erro e vazio são telas DIFERENTES, com ações diferentes, e nunca se
          confundem: quem está sem rede não tem o que registrar de novo, e quem
          nunca registrou não tem o que tentar de novo. Mostrar "nenhum registro
          ainda" pra quem tem 200 registros e caiu a conexão é dizer a ela que o
          app perdeu tudo.

          O erro tem precedência sobre o vazio: com falha de rede, lista vazia
          não significa "não há nada", significa "não sei".
        */}
        {erro ? (
          <Aviso
            icone="cloud-offline-outline"
            titulo="Não consegui carregar agora"
            texto={erro}
            acao={{ label: 'Tentar de novo', onPress: recarregar }}
          />
        ) : carregando ? (
          <View style={styles.centro}>
            <ActivityIndicator color={colors.rosa500} />
          </View>
        ) : vazio ? (
          <Aviso
            icone="leaf-outline"
            titulo="Nada por aqui ainda"
            texto={`Assim que você registrar a primeira mamada, soneca ou troca de ${bebeAtivo.name}, ela aparece aqui.`}
            acao={{ label: 'Fazer o primeiro registro', onPress: () => router.push('/(tabs)') }}
          />
        ) : (
          <>
            {grupos.map((grupo) => (
              <View key={grupo.dia} style={styles.grupo}>
                <Text style={styles.diaLabel}>
                  {/* Rótulo a partir do primeiro registro do grupo, não da chave:
                      a chave é 'AAAA-MM-DD' e virar Date de novo reintroduziria
                      justamente a leitura em UTC que o agrupamento evitou. */}
                  {rotularDia(grupo.registros[0].ocorridoEm)}
                </Text>
                <Text style={styles.diaContagem}>
                  {grupo.registros.length}{' '}
                  {grupo.registros.length === 1 ? 'registro' : 'registros'}
                </Text>

                <View style={styles.lista}>
                  {grupo.registros.map((r) => (
                    <ItemRegistro
                      key={`${r.tipo}-${r.id}`}
                      registro={r}
                      horaLabel={formatarHora(r.ocorridoEm)}
                      onPress={() => router.push(`/detalhe/${r.tipo}/${r.id}`)}
                    />
                  ))}
                </View>
              </View>
            ))}

            {temMais ? (
              <Pressable
                onPress={carregarMais}
                disabled={carregandoMais}
                accessibilityRole="button"
                style={[styles.carregarMais, carregandoMais && styles.ocupado]}
              >
                <Text style={styles.carregarMaisLabel}>
                  {carregandoMais ? 'Carregando…' : 'Carregar mais'}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.fim}>Chegou ao começo dos registros.</Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Aviso({
  icone,
  titulo,
  texto,
  acao,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  titulo: string;
  texto: string;
  acao: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.aviso}>
      <Ionicons name={icone} size={32} color={colors.neutro300} />
      <Text style={styles.avisoTitulo}>{titulo}</Text>
      <Text style={styles.avisoTexto}>{texto}</Text>
      <Pressable onPress={acao.onPress} accessibilityRole="button" style={styles.avisoBotao}>
        <Text style={styles.avisoBotaoLabel}>{acao.label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutro50 },
  // Mesma coluna de 480 da Home: sem isso a web estica a lista de ponta a ponta.
  scroll: { padding: spacing.lg, width: '100%', maxWidth: 480, alignSelf: 'center' },
  titulo: { ...typography.h1, color: colors.headline },
  subtitulo: { ...typography.body, color: colors.neutro500, marginBottom: spacing.lg },
  centro: { paddingVertical: spacing.xxl, alignItems: 'center' },
  grupo: { marginBottom: spacing.lg },
  diaLabel: { ...typography.label, color: colors.neutro600, letterSpacing: 0.6 },
  diaContagem: { ...typography.caption, color: colors.neutro400, marginBottom: spacing.sm },
  lista: { gap: spacing.xs },
  carregarMais: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.neutro0,
    marginTop: spacing.sm,
  },
  ocupado: { opacity: 0.6 },
  carregarMaisLabel: { ...typography.label, color: colors.rosa700 },
  fim: {
    ...typography.caption,
    color: colors.neutro400,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  aviso: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  avisoTitulo: { ...typography.h3, color: colors.headline, textAlign: 'center' },
  avisoTexto: { ...typography.body, color: colors.neutro500, textAlign: 'center' },
  avisoBotao: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.rosa100,
    marginTop: spacing.xs,
  },
  avisoBotaoLabel: { ...typography.label, color: colors.rosa700 },
});
