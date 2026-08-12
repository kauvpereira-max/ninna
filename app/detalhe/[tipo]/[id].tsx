import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  apagarRegistro,
  buscarRegistro,
  ehTipoRegistro,
  type DetalheRegistro,
} from '../../../src/lib/registros';
import { CATEGORIA_POR_TIPO } from '../../../src/theme/categorias';
import { colors, spacing, radius, typography } from '../../../src/theme/tokens';

/**
 * Registro aberto, com o botão de apagar visível.
 *
 * É o caminho PRINCIPAL de exclusão, não um atalho. O canal do beta é PWA web, e
 * long-press ali é traiçoeiro: no Safari do iPhone o toque longo dispara o callout
 * do sistema e a seleção de texto antes de qualquer handler, e no desktop o gesto
 * simplesmente não existe. Um botão que se vê e se lê funciona nos três lugares.
 *
 * ESCOPO TRAVADO: VER E APAGAR. Não editar.
 *
 * Os campos são leitura pura — nenhum é `TextInput`, e a única ação da tela é o
 * botão de apagar. Editar valor de registro abriria um caminho de dados novo que
 * o motor de personalização teria que reconciliar (um `started_at` alterado move
 * o registro na linha do tempo e muda o intervalo médio entre mamadas já
 * calculado), e reconciliação é justamente o tipo de trabalho que não cabe em 21
 * dias. Registro errado se apaga e se refaz.
 *
 * A rota é a base que a Rotina do D5–D7 vai reaproveitar. Se alguém for
 * acrescentar edição aqui, o lugar da decisão é o BETA.md, não este arquivo.
 */
export default function DetalheRegistroScreen() {
  const { tipo, id } = useLocalSearchParams<{ tipo: string; id: string }>();
  const router = useRouter();

  const [registro, setRegistro] = useState<DetalheRegistro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);

  const tipoValido = ehTipoRegistro(tipo);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregar() {
        if (!tipoValido || !id) {
          setCarregando(false);
          return;
        }
        const { data, error } = await buscarRegistro(id);
        if (!ativo) return;
        setRegistro(data);
        setErro(error);
        setCarregando(false);
      }

      carregar();
      return () => {
        ativo = false;
      };
    }, [tipo, id, tipoValido])
  );

  async function handleApagar() {
    if (!tipoValido || !id) return;
    setApagando(true);
    setErro(null);

    const { error } = await apagarRegistro(id);

    if (error) {
      setApagando(false);
      setConfirmando(false);
      setErro(error);
      return;
    }

    // Volta sem esperar nada: a Home recarrega no foco, então o registro some da
    // lista sozinho — inclusive quando era o sono em andamento, e aí o contador
    // "Dormindo há X min" para junto, porque o tick só existe enquanto a lista
    // tiver sono aberto.
    router.back();
  }

  // URL montada à mão (é web: dá pra digitar). Não é erro da mãe, mas não pode virar
  // tela quebrada.
  if (!tipoValido || !id) {
    return (
      <Aviso
        titulo="Registro não encontrado"
        texto="Esse endereço não corresponde a nenhum registro."
        onFechar={() => router.back()}
      />
    );
  }

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centro}>
          <ActivityIndicator color={colors.rosa500} />
        </View>
      </SafeAreaView>
    );
  }

  if (!registro) {
    return (
      <Aviso
        titulo="Esse registro não está mais aqui"
        texto={erro ?? 'Esse registro pode ter sido apagado noutro aparelho.'}
        onFechar={() => router.back()}
      />
    );
  }

  const visual = CATEGORIA_POR_TIPO[registro.tipo];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topo}>
          <Text style={styles.categoria}>{visual.label}</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            hitSlop={12}
          >
            <Ionicons name="close" size={24} color={colors.neutro400} />
          </Pressable>
        </View>

        <View style={styles.cabecalho}>
          <View style={[styles.badge, { backgroundColor: visual.bg }]}>
            <Ionicons name={visual.icon} size={24} color={colors.onDark} />
          </View>
          <Text style={styles.resumo}>{registro.resumo}</Text>
        </View>

        {/* A comparação com a medida anterior — a tese em uma linha, e só o
            crescimento tem. Fica logo abaixo do número porque é a leitura dele:
            "4,35 kg" não diz nada sozinho, "ganhou 340 g" diz. */}
        {registro.comparacao ? (
          <Text style={styles.comparacao}>{registro.comparacao}</Text>
        ) : null}

        <View style={styles.campos}>
          {registro.campos.map((campo) => (
            <View key={campo.rotulo} style={styles.campo}>
              <Text style={styles.campoRotulo}>{campo.rotulo}</Text>
              <Text style={styles.campoValor}>{campo.valor}</Text>
            </View>
          ))}
        </View>

        {registro.notas ? (
          <View style={styles.notas}>
            <Text style={styles.campoRotulo}>Anotação</Text>
            <Text style={styles.notasTexto}>{registro.notas}</Text>
          </View>
        ) : null}

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        {/* Editar some enquanto ela confirma o apagar: duas ações concorrentes
            no mesmo instante é como se toca a errada. */}
        {confirmando ? null : (
          <Pressable
            onPress={() => router.push(`/registro/${registro.tipo}?id=${registro.id}`)}
            accessibilityRole="button"
            accessibilityLabel="Editar registro"
            style={styles.botaoEditar}
          >
            <Ionicons name="create-outline" size={16} color={colors.rosa700} />
            <Text style={styles.botaoEditarLabel}>Editar registro</Text>
          </Pressable>
        )}

        {/* Confirmação inline, não Alert: o react-native-web não implementa
            Alert.alert com dois botões, e window.confirm bloqueia a página inteira.
            Duas etapas na própria tela funcionam igual na web e no nativo. */}
        {confirmando ? (
          <View style={styles.confirmacao}>
            <Text style={styles.confirmacaoTexto}>
              Apagar este registro? Some do histórico e das contas da Ninna.
            </Text>
            <Pressable
              onPress={handleApagar}
              disabled={apagando}
              accessibilityRole="button"
              style={[styles.botaoApagar, apagando && styles.botaoOcupado]}
            >
              <Text style={styles.botaoApagarLabel}>
                {apagando ? 'Apagando…' : 'Sim, apagar'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirmando(false)}
              disabled={apagando}
              accessibilityRole="button"
              style={styles.botaoCancelar}
            >
              <Text style={styles.botaoCancelarLabel}>Cancelar</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setConfirmando(true)}
            accessibilityRole="button"
            accessibilityLabel="Apagar registro"
            style={styles.botaoApagarDiscreto}
          >
            <Ionicons name="trash-outline" size={16} color={colors.coral600} />
            <Text style={styles.botaoApagarDiscretoLabel}>Apagar registro</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Aviso({
  titulo,
  texto,
  onFechar,
}: {
  titulo: string;
  texto: string;
  onFechar: () => void;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centro}>
        <Text style={styles.avisoTitulo}>{titulo}</Text>
        <Text style={styles.avisoTexto}>{texto}</Text>
        <Pressable onPress={onFechar} accessibilityRole="button" style={styles.botaoCancelar}>
          <Text style={styles.botaoCancelarLabel}>Voltar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutro50 },
  scroll: { padding: spacing.lg, width: '100%', maxWidth: 480, alignSelf: 'center' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  categoria: { ...typography.label, color: colors.neutro500, letterSpacing: 1 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumo: { ...typography.h2, color: colors.headline, flex: 1 },
  comparacao: {
    ...typography.body,
    color: colors.neutro700,
    marginTop: spacing.md,
  },
  campos: { marginTop: spacing.xl, gap: spacing.md },
  campo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md },
  campoRotulo: { ...typography.caption, color: colors.neutro500 },
  campoValor: { ...typography.bodyLarge, color: colors.headline, textAlign: 'right', flexShrink: 1 },
  notas: {
    marginTop: spacing.lg,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  notasTexto: { ...typography.body, color: colors.neutro700 },
  erro: { ...typography.caption, color: colors.coral600, marginTop: spacing.lg },
  botaoEditar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  botaoEditarLabel: { ...typography.body, color: colors.rosa700 },
  botaoApagarDiscreto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxl,
    // 44px de alvo: dedo de mãe com bebê no colo, no meio da madrugada.
    minHeight: 44,
  },
  botaoApagarDiscretoLabel: { ...typography.body, color: colors.coral600 },
  confirmacao: {
    marginTop: spacing.xxl,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  confirmacaoTexto: { ...typography.body, color: colors.neutro700 },
  botaoApagar: {
    minHeight: 44,
    borderRadius: radius.full,
    backgroundColor: colors.coral600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoOcupado: { opacity: 0.6 },
  botaoApagarLabel: { ...typography.label, color: colors.onDark },
  botaoCancelar: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  botaoCancelarLabel: { ...typography.body, color: colors.neutro500 },
  avisoTitulo: { ...typography.h2, color: colors.headline, textAlign: 'center' },
  avisoTexto: {
    ...typography.body,
    color: colors.neutro500,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
