import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  buscarAfiliada,
  buscarNumeros,
  listarExtrato,
  emReais,
  type Afiliada,
  type NumerosDaAfiliada,
  type MovimentoComissao,
} from '../src/lib/afiliadas';
import { formatarMomento } from '../src/lib/horario';
import { colors, spacing, radius, typography } from '../src/theme/tokens';

/**
 * O painel da afiliada.
 *
 * ------------------------------------------------------------------
 * ⚠️ ESTA TELA NÃO MOSTRA QUEM INDICOU, E ELA NÃO CONSEGUIRIA
 *
 * Não há aqui uma consulta cuidadosa que evita a coluna errada: `indicacoes` tem
 * RLS ligada e zero policies (migration 008), então a identidade da mãe não
 * chega até este arquivo por caminho nenhum.
 *
 * Isso importa para quem for mexer aqui depois: somar "ver minhas indicadas" não
 * é somar uma tela — é derrubar o requisito no banco primeiro. E o requisito é
 * do termo, não da tela.
 *
 * ------------------------------------------------------------------
 * DOIS NÚMEROS, E "DISPONÍVEL" SÓ APARECE NUM DELES
 *
 * Total acumulado é o que ela ganhou. Disponível é o que já passou da carência
 * de 30 dias e pode ser sacado.
 *
 * Chamar o primeiro de "disponível" seria prometer dinheiro que ainda pode
 * voltar num estorno — e é a mesma disciplina do card de insight: não dizer
 * antes de saber. O que está esperando aparece com nome próprio, para ela não
 * subtrair de cabeça e concluir que sumiu.
 *
 * ------------------------------------------------------------------
 * AUDIÊNCIA DIFERENTE, TOM DIFERENTE — E MESMO ASSIM SEM PRONOME
 *
 * Este é o primeiro produto da Ninna cujo público não é a mãe. As regras de
 * copy que protegem a tese (nada de média, nada sobre bebê) não se aplicam a
 * um painel de comissão.
 *
 * A copy daqui continua sem pronome de gênero assim mesmo — não por regra
 * herdada, mas porque não custa nada e mantém as varreduras com cobertura
 * total. Abrir exceção no extrator seria o começo de uma varredura que mente.
 */
export default function PainelAfiliadaScreen() {
  const router = useRouter();

  const [afiliada, setAfiliada] = useState<Afiliada | null>(null);
  const [numeros, setNumeros] = useState<NumerosDaAfiliada | null>(null);
  const [extrato, setExtrato] = useState<MovimentoComissao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregar() {
        const cadastro = await buscarAfiliada();
        if (!ativo) return;

        setAfiliada(cadastro.data);
        setErro(cadastro.error);

        // Sem cadastro não há o que buscar — e não faz sentido gastar duas
        // consultas para descobrir isso.
        if (!cadastro.data) {
          setCarregando(false);
          return;
        }

        const [n, e] = await Promise.all([buscarNumeros(), listarExtrato()]);
        if (!ativo) return;

        setNumeros(n.data);
        setExtrato(e.data);
        setErro(n.error ?? e.error);
        setCarregando(false);
      }

      carregar();
      return () => {
        ativo = false;
      };
    }, [])
  );

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centro}>
          <ActivityIndicator color={colors.rosa500} />
        </View>
      </SafeAreaView>
    );
  }

  /*
    Conta sem cadastro de afiliada. A rota é digitável (é web), então isto não é
    caso impossível — é o caso normal de quem tocou num link que não era pra ela.
    Sem tom de acusação e sem dizer que o programa existe pra quem não faz parte.
  */
  if (!afiliada) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centro}>
          <Text style={styles.avisoTitulo}>Esta área não é da sua conta</Text>
          <Text style={styles.avisoTexto}>
            Este endereço é do painel de parceiras da Ninna.
          </Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.voltar}>
            <Text style={styles.voltarLabel}>Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topo}>
          <Text style={styles.categoria}>PAINEL DE PARCEIRA</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            hitSlop={12}
          >
            <Ionicons name="close" size={24} color={colors.neutro400} />
          </Pressable>
        </View>

        <Text style={styles.nome}>{afiliada.nome}</Text>

        <View style={styles.linkCard}>
          <Text style={styles.campoRotulo}>Seu link</Text>
          <Text style={styles.link} selectable>
            ninna-sigma.vercel.app/?ref={afiliada.codigo}
          </Text>
        </View>

        {!afiliada.ativa ? (
          <Text style={styles.pausada}>
            Seu link está pausado no momento. As comissões já registradas continuam aqui.
          </Text>
        ) : null}

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        {/* O número que pode ser sacado vem PRIMEIRO e é o maior: é o que ela
            abriu a tela para ver. */}
        <View style={styles.numeroPrincipal}>
          <Text style={styles.campoRotulo}>Disponível para saque</Text>
          <Text style={styles.valorGrande}>{emReais(numeros?.disponivelCentavos ?? 0)}</Text>
          <Text style={styles.explicacao}>
            Cada comissão fica 30 dias esperando antes de liberar — é o prazo em que uma
            compra ainda pode ser devolvida.
          </Text>
        </View>

        <View style={styles.numerosSecundarios}>
          <View style={styles.numeroSecundario}>
            <Text style={styles.campoRotulo}>Ainda esperando</Text>
            <Text style={styles.valorMedio}>{emReais(numeros?.emCarenciaCentavos ?? 0)}</Text>
          </View>
          <View style={styles.numeroSecundario}>
            <Text style={styles.campoRotulo}>Total acumulado</Text>
            <Text style={styles.valorMedio}>{emReais(numeros?.totalCentavos ?? 0)}</Text>
          </View>
        </View>

        <View style={styles.numerosSecundarios}>
          <View style={styles.numeroSecundario}>
            <Text style={styles.campoRotulo}>Cadastros pelo seu link</Text>
            <Text style={styles.valorMedio}>{numeros?.indicacoesTotal ?? 0}</Text>
          </View>
          <View style={styles.numeroSecundario}>
            <Text style={styles.campoRotulo}>Viraram assinatura</Text>
            <Text style={styles.valorMedio}>{numeros?.indicacoesPagas ?? 0}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>EXTRATO</Text>

        {extrato.length === 0 ? (
          <Text style={styles.vazio}>
            Nada por aqui ainda. A primeira comissão aparece quando alguém que veio pelo
            seu link assinar.
          </Text>
        ) : (
          <View style={styles.lista}>
            {extrato.map((m) => (
              <View key={m.id} style={styles.movimento}>
                <View style={styles.movimentoTexto}>
                  <Text style={styles.movimentoTipo}>
                    {m.tipo === 'credito' ? 'Comissão' : 'Compra devolvida'}
                  </Text>
                  <Text style={styles.movimentoData}>{formatarMomento(m.criadaEm)}</Text>
                </View>
                <Text style={m.tipo === 'credito' ? styles.valorPositivo : styles.valorNegativo}>
                  {emReais(m.valorCentavos)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Sem prazo prometido: o pagamento é manual, e prometer data seria
            passar para outra pessoa uma promessa que ela vai ter que cumprir à
            mão. Ver PRODUTO.md §3.5. */}
        <Text style={styles.rodape}>
          Para receber, é só me chamar. O pagamento é combinado direto, e eu confirmo aqui
          quando sair.
        </Text>
      </ScrollView>
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
    marginBottom: spacing.sm,
  },
  categoria: { ...typography.label, color: colors.neutro500, letterSpacing: 1 },
  nome: { ...typography.h2, color: colors.headline, marginBottom: spacing.lg },
  linkCard: {
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  link: { ...typography.body, color: colors.rosa700 },
  pausada: { ...typography.caption, color: colors.neutro500, marginTop: spacing.sm },
  erro: { ...typography.caption, color: colors.coral600, marginTop: spacing.md },
  numeroPrincipal: {
    marginTop: spacing.lg,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  valorGrande: { ...typography.h1, color: colors.headline },
  explicacao: { ...typography.caption, color: colors.neutro500, marginTop: spacing.xs },
  numerosSecundarios: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  numeroSecundario: {
    flex: 1,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  valorMedio: { ...typography.bodyLarge, color: colors.headline },
  campoRotulo: { ...typography.caption, color: colors.neutro500 },
  sectionLabel: {
    ...typography.label,
    color: colors.neutro500,
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  vazio: { ...typography.body, color: colors.neutro500 },
  lista: { gap: spacing.sm },
  movimento: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  movimentoTexto: { flex: 1, gap: 2 },
  movimentoTipo: { ...typography.body, color: colors.headline },
  movimentoData: { ...typography.caption, color: colors.neutro500 },
  valorPositivo: { ...typography.bodyLarge, color: colors.headline },
  valorNegativo: { ...typography.bodyLarge, color: colors.coral600 },
  rodape: { ...typography.caption, color: colors.neutro500, marginTop: spacing.xl },
  avisoTitulo: { ...typography.h2, color: colors.headline, textAlign: 'center' },
  avisoTexto: {
    ...typography.body,
    color: colors.neutro500,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  voltar: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  voltarLabel: { ...typography.body, color: colors.neutro500 },
});
