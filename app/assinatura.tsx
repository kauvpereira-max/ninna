import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../src/components/Button';
import { assinar, estadoDaAssinatura, gerenciar, type Assinatura } from '../src/lib/assinatura';
import { assinaturaValida } from '../src/lib/acesso';
import { colors, spacing, radius, typography } from '../src/theme/tokens';

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

const PLANOS = [
  {
    id: 'mensal' as const,
    titulo: 'Mensal',
    preco: 'R$ 24,90',
    periodo: 'por mês',
    detalhe: null as string | null,
  },
  {
    id: 'anual' as const,
    titulo: 'Anual',
    preco: 'R$ 149,90',
    periodo: 'por ano',
    detalhe: 'Sai por R$ 12,49 por mês',
  },
];

export default function AssinaturaScreen() {
  const router = useRouter();
  const { estado } = useLocalSearchParams<{ estado?: string }>();
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      estadoDaAssinatura().then((a) => {
        if (vivo) setAssinatura(a);
      });
      return () => {
        vivo = false;
      };
    }, [])
  );

  const valida = assinatura ? assinaturaValida(assinatura) : false;
  const emTeste = assinatura?.status === 'trialing';
  // Voltou da Stripe dizendo que terminou, mas o webhook ainda não gravou.
  const confirmando = estado === 'pronto' && assinatura !== null && !valida;

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

            <View style={styles.planos}>
              {PLANOS.map((plano) => (
                <Pressable
                  key={plano.id}
                  onPress={() => escolher(plano.id)}
                  disabled={ocupado !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Assinar plano ${plano.titulo}, ${plano.preco} ${plano.periodo}`}
                  style={[styles.plano, ocupado !== null && styles.planoInativo]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planoTitulo}>{plano.titulo}</Text>
                    {plano.detalhe ? <Text style={styles.planoDetalhe}>{plano.detalhe}</Text> : null}
                  </View>
                  <View style={styles.planoPreco}>
                    <Text style={styles.precoValor}>{plano.preco}</Text>
                    <Text style={styles.precoPeriodo}>{plano.periodo}</Text>
                  </View>
                  {ocupado === plano.id ? (
                    <ActivityIndicator size="small" color={colors.rosa500} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={colors.neutro300} />
                  )}
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
  container: { flex: 1, backgroundColor: colors.neutro50 },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  planoInativo: { opacity: 0.6 },
  planoTitulo: { ...typography.bodyLarge, color: colors.headline },
  planoDetalhe: { ...typography.caption, color: colors.rosa700, marginTop: 2 },
  planoPreco: { alignItems: 'flex-end' },
  precoValor: { ...typography.bodyLarge, color: colors.headline, fontFamily: 'NunitoSans_700Bold' },
  precoPeriodo: { ...typography.caption, color: colors.neutro500 },

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
