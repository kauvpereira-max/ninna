import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../src/components/Button';
import { assinar, estadoDaAssinatura, gerenciar, type Assinatura } from '../src/lib/assinatura';
import { assinaturaValida } from '../src/lib/acesso';
import { colors, spacing, radius, typography, elevation } from '../src/theme/tokens';

/**
 * A tela de assinatura.
 *
 * É também o destino de volta do Checkout — a Stripe devolve aqui com
 * `?estado=pronto` ou `?estado=cancelado`. Por isso ela é rota de raiz e não
 * modal: quem chega da Stripe chega numa carga fria de página, sem pilha por
 * baixo para uma modal se apoiar.
 *
 * ------------------------------------------------------------------
 * O ESTADO "PRONTO" NÃO É PROVA DE PAGAMENTO
 *
 * Voltar por `success_url` significa que a mãe terminou o formulário — não que a
 * assinatura está paga e ativa. Quem diz isso é o webhook, que chega por outro
 * caminho e pode demorar alguns segundos.
 *
 * Então esta tela nunca libera nada por causa da URL: ela relê o estado do banco
 * a cada foco. Enquanto o webhook não chegou, a mãe vê "confirmando", que é a
 * verdade — e não um "pronto!" que pode ser desmentido no próximo toque.
 */

/**
 * ⚠️ O ANUAL VEM PRIMEIRO, e o destacado é ele — como no protótipo.
 *
 * E o SELO é a única coisa desta tela que o protótipo perdeu. Ele dizia
 * "Mais escolhido pelas mães": afirmação social, com uma usuária, na tela onde
 * ela decide pagar. Se ela descobrir que era invenção, contamina tudo o que a
 * Ninna diz sobre o bebê dela — a tese inteira depende de a Ninna só afirmar o
 * que pode verificar.
 *
 * "Economize R$ 148,90" é aritmética que ela confere sozinha: 24,90 × 12 =
 * 298,80, menos 149,90. Conferido em 14/08/2026.
 *
 * Os VALORES batem com o protótipo e com a Stripe. A exceção de precedência que
 * existia aqui — preço é dado, e o dado que vale é o que a Stripe cobra — não
 * precisou ser usada.
 */
const PLANOS = [
  {
    id: 'anual' as const,
    titulo: 'Anual',
    preco: 'R$ 149,90',
    periodo: '/ano',
    detalhe: 'Apenas R$ 12,49 por mês',
    selo: 'Economize R$ 148,90',
    destaque: true,
    acao: 'Começar meus 7 dias grátis',
  },
  {
    id: 'mensal' as const,
    titulo: 'Mensal',
    preco: 'R$ 24,90',
    periodo: '/mês',
    detalhe: null as string | null,
    selo: null as string | null,
    destaque: false,
    acao: 'Assinar mensalmente',
  },
];

/**
 * Trinta segundos de insistência, de dois em dois.
 *
 * O webhook normal chega em um ou dois; a janela é larga para caber reentrega
 * da Stripe, que é o caso lento e legítimo. Passou disso, a tela fala.
 */
const INTERVALO_MS = 2000;
const MAX_TENTATIVAS = 15;

export default function AssinaturaScreen() {
  const router = useRouter();
  const { estado } = useLocalSearchParams<{ estado?: string }>();
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [demorou, setDemorou] = useState(false);

  /**
   * Lê o estado — e insiste enquanto ela está esperando o webhook.
   *
   * Ler uma vez só não bastava, e o motivo é de corrida: o Checkout devolve a
   * mãe para cá em menos tempo do que a Stripe leva para entregar o evento. Na
   * volta de 11/08/2026 a diferença foi de menos de dois segundos — a página
   * carregou, leu "ainda não", e ficou em "confirmando" para sempre.
   *
   * "Para sempre" porque na web isto é carga fria de página: o foco nunca muda
   * de novo, então `useFocusEffect` não dispara segunda vez. Esperar não
   * resolvia nada, e a linha certa já estava no banco.
   *
   * A insistência é limitada de propósito. Se em `MAX_TENTATIVAS` não entrou,
   * alguma coisa está errada de verdade, e ficar girando esconde isso da mãe —
   * ela merece uma frase, não uma bolinha eterna.
   */
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      let tentativas = 0;
      let relogio: ReturnType<typeof setTimeout> | undefined;

      async function ler() {
        const atual = await estadoDaAssinatura();
        if (!vivo) return;
        setAssinatura(atual);

        // Só insiste quem acabou de voltar do Checkout. Nas outras entradas na
        // tela, uma leitura é a resposta inteira.
        const esperando = estado === 'pronto' && !assinaturaValida(atual);
        if (!esperando) return;

        if (tentativas < MAX_TENTATIVAS) {
          tentativas += 1;
          relogio = setTimeout(ler, INTERVALO_MS);
        } else {
          setDemorou(true);
        }
      }

      ler();
      return () => {
        vivo = false;
        if (relogio) clearTimeout(relogio);
      };
    }, [estado])
  );

  const valida = assinatura ? assinaturaValida(assinatura) : false;
  const emTeste = assinatura?.status === 'trialing';
  // Voltou da Stripe dizendo que terminou, mas o webhook ainda não gravou.
  const confirmando = estado === 'pronto' && assinatura !== null && !valida && !demorou;

  async function escolher(plano: 'mensal' | 'anual') {
    setErro(null);
    setOcupado(plano);
    const falha = await assinar(plano);
    if (falha) {
      setErro(falha);
      setOcupado(null);
    }
    // Sem `setOcupado(null)` no sucesso: a página está saindo para a Stripe, e
    // devolver o botão ao normal antes disso convida a um segundo toque.
  }

  async function abrirPortal() {
    setErro(null);
    setOcupado('portal');
    const falha = await gerenciar();
    if (falha) {
      setErro(falha);
      setOcupado(null);
    }
  }

  function fechar() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/mais');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>Plano da Ninna</Text>
            <Text style={styles.subtitulo}>
              {valida ? 'Sua assinatura está ativa' : 'Converse com a Ninna sobre a rotina do seu bebê'}
            </Text>
          </View>
          <Pressable onPress={fechar} accessibilityRole="button" accessibilityLabel="Fechar" style={styles.fechar}>
            <Ionicons name="close" size={22} color={colors.neutro500} />
          </Pressable>
        </View>

        {estado === 'cancelado' ? (
          <View style={styles.aviso}>
            <Text style={styles.avisoTexto}>
              Você saiu antes de terminar, e nada foi cobrado. Pode voltar quando quiser.
            </Text>
          </View>
        ) : null}

        {confirmando ? (
          <View style={[styles.aviso, styles.avisoConfirmando]}>
            <ActivityIndicator size="small" color={colors.rosa500} />
            <Text style={styles.avisoTexto}>
              Estou confirmando o pagamento. Isso leva alguns segundos — pode fechar e voltar.
            </Text>
          </View>
        ) : null}

        {demorou && !valida ? (
          <View style={styles.aviso}>
            <Text style={styles.avisoTexto}>
              A confirmação ainda não chegou. Se o pagamento saiu, a assinatura entra sozinha —
              pode fechar e voltar daqui a pouco.
            </Text>
          </View>
        ) : null}

        {valida ? (
          <View style={styles.cartaoAtivo}>
            <Text style={styles.ativoTitulo}>
              {emTeste ? 'Você está nos dias grátis' : 'Assinatura ativa'}
            </Text>
            {assinatura?.validaAte ? (
              <Text style={styles.ativoTexto}>
                {emTeste ? 'A primeira cobrança é em ' : 'Renova em '}
                {new Date(assinatura.validaAte).toLocaleDateString('pt-BR')}.
              </Text>
            ) : null}
            <Button
              label={ocupado === 'portal' ? 'Abrindo…' : 'Gerenciar assinatura'}
              variant="secondary"
              onPress={abrirPortal}
              loading={ocupado === 'portal'}
              style={{ marginTop: spacing.md }}
            />
            <Text style={styles.rodapeTexto}>
              Cancelar, trocar o cartão e ver as faturas ficam aí dentro.
            </Text>
          </View>
        ) : (
          <>
            {/* O que ela ganha vem antes do preço, e diz o que continua grátis.
                Uma tela de plano que só lista preço faz a mãe calcular; dizer o
                que ela já tem e não perde faz ela decidir. */}
            <View style={styles.oQueEntra}>
              <Text style={styles.oQueEntraTitulo}>O plano abre a conversa com a Ninna</Text>
              <Text style={styles.oQueEntraTexto}>
                Perguntar sobre a rotina do seu bebê a qualquer hora — quanto tempo desde a última
                mamada, quantas trocas hoje, o que vem se repetindo nos últimos dias.
              </Text>
              <Text style={styles.oQueEntraTexto}>
                Registrar, ver a rotina e acompanhar o que a Ninna já percebeu continuam de graça,
                sem prazo.
              </Text>
            </View>

            {/* Um CARD por plano, o destacado primeiro — como no protótipo. A
                lista de duas linhas com chevron não dizia qual valia mais a
                pena; o card diz, e diz com aritmética. */}
            <View style={styles.planos}>
              {PLANOS.map((plano) => (
                <Pressable
                  key={plano.id}
                  onPress={() => escolher(plano.id)}
                  disabled={ocupado !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Assinar plano ${plano.titulo}, ${plano.preco} ${plano.periodo}`}
                  style={[
                    styles.plano,
                    plano.destaque && styles.planoDestaque,
                    ocupado !== null && styles.planoInativo,
                  ]}
                >
                  {plano.selo ? (
                    <View style={styles.selo}>
                      <Text style={styles.seloTexto}>{plano.selo}</Text>
                    </View>
                  ) : null}

                  <Text style={styles.planoTitulo}>{plano.titulo}</Text>

                  <View style={styles.linhaDoPreco}>
                    <Text style={styles.precoValor}>{plano.preco}</Text>
                    <Text style={styles.precoPeriodo}>{plano.periodo}</Text>
                  </View>

                  {plano.detalhe ? <Text style={styles.planoDetalhe}>{plano.detalhe}</Text> : null}

                  <View style={[styles.cta, plano.destaque && styles.ctaDestaque]}>
                    {ocupado === plano.id ? (
                      <ActivityIndicator size="small" color={colors.neutro0} />
                    ) : (
                      <Text
                        style={[styles.ctaTexto, plano.destaque && styles.ctaTextoDestaque]}
                      >
                        {plano.acao}
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>

            <Text style={styles.rodapeTexto}>
              Sete dias grátis para experimentar. Dá para cancelar quando quiser, e o pagamento é
              pela Stripe — a Ninna não guarda seu cartão.
            </Text>
          </>
        )}

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}
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

  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  avisoConfirmando: { backgroundColor: colors.rosa100 },
  avisoTexto: { ...typography.body, color: colors.neutro600, flex: 1 },

  oQueEntra: { marginTop: spacing.xl, gap: spacing.sm },
  oQueEntraTitulo: { ...typography.h3, color: colors.headline },
  oQueEntraTexto: { ...typography.bodyLarge, color: colors.neutro600 },

  planos: { marginTop: spacing.xl, gap: spacing.sm },
  plano: {
    backgroundColor: colors.neutro0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.linha,
    padding: spacing.respiro,
    gap: spacing.sm,
  },
  /**
   * A borda de destaque é `coralAcao`, e NÃO o `#E15C42` do protótipo.
   *
   * Borda promocional é decoração, e o `#E15C42` é a cor de vigilância — ela
   * significa "está acontecendo agora". Usá-la para vender plano é exatamente o
   * caso que a regra do `CLAUDE.md` proíbe pelo nome.
   */
  planoDestaque: {
    borderWidth: 2,
    borderColor: colors.coralAcao,
    ...elevation.acaoCoral,
  },
  planoInativo: { opacity: 0.6 },
  selo: {
    alignSelf: 'flex-start',
    backgroundColor: colors.coralAcao,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: spacing.xs,
  },
  seloTexto: {
    ...typography.itemRotulo,
    fontFamily: 'NunitoSans_700Bold',
    fontSize: 11.5,
    letterSpacing: 0.4,
    color: colors.onDark,
  },
  planoTitulo: { ...typography.tituloCard, color: colors.headline },
  linhaDoPreco: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  precoValor: { ...typography.display, fontSize: 30, letterSpacing: -0.5, color: colors.headline },
  precoPeriodo: { ...typography.itemRotulo, color: colors.neutro500 },
  planoDetalhe: { ...typography.itemRotulo, color: colors.rosa700 },
  cta: {
    height: 48,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.rosa200,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  ctaDestaque: { backgroundColor: colors.rosa500, borderColor: colors.rosa500 },
  ctaTexto: { ...typography.cta, fontSize: 15, color: colors.rosa700 },
  ctaTextoDestaque: { color: colors.neutro0 },

  cartaoAtivo: {
    marginTop: spacing.xl,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  ativoTitulo: { ...typography.h3, color: colors.headline },
  ativoTexto: { ...typography.body, color: colors.neutro600, marginTop: spacing.xs },

  rodapeTexto: { ...typography.caption, color: colors.neutro500, marginTop: spacing.md },
  erro: { ...typography.body, color: colors.coral600, marginTop: spacing.md },
});
