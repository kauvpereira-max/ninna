import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBaby } from '../../src/contexts/BabyContext';
import { useHistorico } from '../../src/hooks/useHistorico';
import { ItemRegistro } from '../../src/components/ItemRegistro';
import { formatarHora, rotularDia } from '../../src/lib/horario';
import type { TipoRegistro } from '../../src/lib/registros';
import { CATEGORIAS, CATEGORIA_POR_TIPO } from '../../src/theme/categorias';
import { colors, spacing, radius, typography } from '../../src/theme/tokens';

export default function RotinaScreen() {
  const { bebeAtivo } = useBaby();
  const router = useRouter();
  const [filtro, setFiltro] = useState<TipoRegistro | null>(null);
  const { grupos, carregando, carregandoMais, erro, temMais, carregarMais, recarregar } =
    useHistorico(bebeAtivo?.id ?? null, filtro);

  if (!bebeAtivo) return null;

  const vazio = grupos.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          // Gesto de puxar: funciona no nativo. No react-native-web isto é um
          // no-op, e no Safari do iPhone o gesto ainda competiria com o reload
          // nativo do navegador — por isso o botão "Atualizar" abaixo não é
          // alternativa, é o mecanismo principal no canal do beta.
          <RefreshControl refreshing={carregando} onRefresh={recarregar} tintColor={colors.rosa500} />
        }
      >
        <View style={styles.cabecalho}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>Rotina</Text>
            <Text style={styles.subtitulo}>Tudo que você registrou, dia a dia</Text>
          </View>
          <Pressable
            onPress={recarregar}
            disabled={carregando}
            accessibilityRole="button"
            accessibilityLabel="Atualizar a lista"
            hitSlop={8}
            style={[styles.atualizar, carregando && styles.ocupado]}
          >
            <Ionicons name="refresh" size={18} color={colors.rosa700} />
          </Pressable>
        </View>

        {/* Chips de tipo. O filtro vai pra consulta e reinicia o cursor — não é
            recorte da página já carregada. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip label="Tudo" ativo={filtro === null} onPress={() => setFiltro(null)} />
          {CATEGORIAS.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              cor={c.bg}
              ativo={filtro === c.key}
              onPress={() => setFiltro(filtro === c.key ? null : c.key)}
            />
          ))}
        </ScrollView>

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
        ) : carregando && vazio ? (
          // Spinner cheio de tela só na primeira carga. Num "atualizar" com lista
          // já na tela, sumir com tudo pra mostrar um spinner faz parecer que os
          // registros se perderam — a lista fica, e o feedback vem do botão.
          <View style={styles.centro}>
            <ActivityIndicator color={colors.rosa500} />
          </View>
        ) : vazio ? (
          /*
            Duas variantes, e a diferença importa. Sem filtro, a mãe nunca
            registrou nada e o que falta é o primeiro registro. Com filtro, ela
            pode ter 200 registros — só nenhum daquele tipo — e mandá-la
            "registrar o primeiro" seria dizer que o histórico dela sumiu. O que
            ela precisa ali é tirar o filtro.
          */
          filtro ? (
            <Aviso
              icone="funnel-outline"
              titulo={`Nenhum registro de ${CATEGORIA_POR_TIPO[filtro].label}`}
              texto={`Os outros registros de ${bebeAtivo.name} continuam aqui — é só tirar o filtro.`}
              acao={{ label: 'Mostrar tudo', onPress: () => setFiltro(null) }}
            />
          ) : (
            <Aviso
              icone="leaf-outline"
              titulo="Nada por aqui ainda"
              texto={`A primeira mamada, soneca ou troca de ${bebeAtivo.name} aparece aqui assim que você registrar.`}
              acao={{ label: 'Fazer o primeiro registro', onPress: () => router.push('/(tabs)') }}
            />
          )
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
              <Text style={styles.fim}>
                {filtro
                  ? `Esses são todos os registros de ${CATEGORIA_POR_TIPO[filtro].label.toLowerCase()}.`
                  : 'Chegou ao começo dos registros.'}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({
  label,
  cor,
  ativo,
  onPress,
}: {
  label: string;
  cor?: string;
  ativo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={`Filtrar por ${label}`}
      style={[styles.chip, ativo && styles.chipAtivo]}
    >
      {/* O ponto de cor é o mesmo do badge do item, pra mãe ligar chip e registro
          sem precisar ler. "Tudo" não tem cor porque não é categoria. */}
      {cor ? <View style={[styles.chipPonto, { backgroundColor: cor }]} /> : null}
      <Text style={[styles.chipLabel, ativo && styles.chipLabelAtivo]}>{label}</Text>
    </Pressable>
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
  cabecalho: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titulo: { ...typography.h1, color: colors.headline },
  subtitulo: { ...typography.body, color: colors.neutro500 },
  atualizar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.rosa100,
  },
  chips: { gap: spacing.xs, paddingVertical: spacing.md, paddingRight: spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.neutro0,
    borderWidth: 1,
    borderColor: colors.neutro100,
  },
  chipAtivo: { backgroundColor: colors.rosa100, borderColor: colors.rosa300 },
  chipPonto: { width: 8, height: 8, borderRadius: radius.full },
  chipLabel: { ...typography.caption, color: colors.neutro600 },
  chipLabelAtivo: { color: colors.rosa700, fontFamily: 'NunitoSans_600SemiBold' },
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
