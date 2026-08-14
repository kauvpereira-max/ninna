import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBaby } from '../../src/contexts/BabyContext';
import { perguntar } from '../../src/lib/assistente';
import { ManchasDaNinna } from '../../src/components/ManchasDaNinna';
import { colors, spacing, radius, typography } from '../../src/theme/tokens';

/**
 * A tela do assistente ancorado.
 *
 * A conversa NÃO é guardada, e isso é arquitetura e não economia: cada pergunta
 * é independente, porque o servidor manda ao modelo só a pergunta — nunca o
 * histórico. Guardar aqui daria a impressão de uma memória que não existe, e a
 * primeira vez que a mãe escrevesse "e ontem?" esperando continuidade, a
 * resposta viria errada.
 *
 * A tela também não decide nada sobre o conteúdo. Ela mostra o que o servidor
 * devolveu — inclusive as recusas, que são resposta e não erro.
 */

/**
 * Exemplos vindos do que a Ninna realmente sabe responder.
 *
 * Escritos sem pronome, pela mesma razão do manifesto em `consultas.ts`: o app
 * não sabe o gênero do bebê. E são consultas reais da superfície, não frases
 * bonitas — sugerir o que ela não responde ensina a mãe a se decepcionar.
 */
const SUGESTOES = [
  'Quando foi a última mamada?',
  'Quantas fraldas hoje?',
  'Que horas costuma pegar no sono?',
];

type Fala = { de: 'mae' | 'ninna'; texto: string };

export default function NinnaScreen() {
  const { bebeAtivo } = useBaby();
  const router = useRouter();
  const [falas, setFalas] = useState<Fala[]>([]);
  const [rascunho, setRascunho] = useState('');
  const [pensando, setPensando] = useState(false);
  const [semCota, setSemCota] = useState(false);
  const [semPlano, setSemPlano] = useState(false);
  const scroll = useRef<ScrollView>(null);

  async function enviar(texto: string) {
    const pergunta = texto.trim();
    if (!pergunta || pensando || semCota || semPlano || !bebeAtivo) return;

    setFalas((atuais) => [...atuais, { de: 'mae', texto: pergunta }]);
    setRascunho('');
    setPensando(true);

    const resposta = await perguntar(pergunta, bebeAtivo.id);

    setFalas((atuais) => [...atuais, { de: 'ninna', texto: resposta.texto }]);
    setPensando(false);
    if (resposta.limite) setSemCota(true);
    if (resposta.semAssinatura) setSemPlano(true);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* O fundo do protótipo, atrás de tudo. Voltou junto com o
          `react-native-svg` dos ícones — a divergência 10 dizia isso. */}
      <ManchasDaNinna />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.scroll}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          {/* O cabeçalho do protótipo, sem o botão de voltar: lá isto é uma tela
              empilhada; aqui é uma ABA, e a volta é a tab bar. Um voltar que
              compete com ela ensinaria dois caminhos para a mesma coisa. */}
          <View style={styles.cabecalho}>
            <View style={styles.marca}>
              <Ionicons name="chatbubble-ellipses" size={18} color={colors.rosa700} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.titulo}>Ninna</Text>
              {bebeAtivo ? (
                <Text style={styles.acompanhando}>Acompanhando {bebeAtivo.name}</Text>
              ) : null}
            </View>
          </View>

          {falas.length === 0 ? (
            <View style={styles.vazio}>
              <View style={styles.circulo}>
                <Ionicons name="chatbubble-ellipses" size={44} color={colors.rosa500} />
              </View>

              {/* ⚠️ O LIMITE VEM ANTES DA PROMESSA, e a ordem é a decisão.
                  O protótipo convida: "pergunte sobre sono, mamadas, fases ou o
                  que estiver te preocupando" — e "o que estiver te preocupando"
                  é exatamente o que cai em `fora_de_escopo` e recebe a frase do
                  pediatra. É a porta maior que a sala, na tela de entrada.
                  Melhor ela ler o limite antes de formular a pergunta do que
                  depois de receber a recusa. */}
              <Text style={styles.vazioTitulo}>O que você quer saber?</Text>
              <Text style={styles.vazioTexto}>
                Eu só sei o que você registrou{bebeAtivo ? ` de ${bebeAtivo.name}` : ''} — horários,
                quantidades e o que vem se repetindo. Pergunte à vontade.
              </Text>

              <View style={styles.sugestoes}>
                {SUGESTOES.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => enviar(s)}
                    accessibilityRole="button"
                    style={styles.sugestao}
                  >
                    <Text style={styles.sugestaoTexto}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            falas.map((fala, i) => (
              <View
                key={`${i}-${fala.texto.slice(0, 12)}`}
                style={[styles.balao, fala.de === 'mae' ? styles.balaoMae : styles.balaoNinna]}
              >
                <Text style={fala.de === 'mae' ? styles.textoMae : styles.textoNinna}>
                  {fala.texto}
                </Text>
              </View>
            ))
          )}

          {pensando ? (
            <View style={[styles.balao, styles.balaoNinna, styles.pensando]}>
              <ActivityIndicator size="small" color={colors.rosa500} />
              <Text style={styles.textoNinna}>Olhando os registros…</Text>
            </View>
          ) : null}
        </ScrollView>

        {semPlano ? (
          // Recusa que oferece o caminho. Um beco sem saída aqui é a mãe
          // fechando o app sem entender que o resto continua dela.
          <View style={styles.rodapeLimite}>
            <Pressable
              onPress={() => router.push('/assinatura')}
              accessibilityRole="button"
              style={styles.verPlano}
            >
              <Text style={styles.verPlanoTexto}>Ver o plano da Ninna</Text>
            </Pressable>
          </View>
        ) : semCota ? (
          // Sem campo de digitar: oferecer um campo que não responde é pior que
          // não oferecer. O teto volta amanhã, e a frase já diz isso.
          <View style={styles.rodapeLimite}>
            <Ionicons name="moon-outline" size={18} color={colors.neutro500} />
            <Text style={styles.limiteTexto}>Por hoje já conversamos bastante. Amanhã eu volto.</Text>
          </View>
        ) : (
          <View style={styles.rodape}>
            <TextInput
              style={styles.campo}
              value={rascunho}
              onChangeText={setRascunho}
              placeholder="Pergunta alguma coisa"
              placeholderTextColor={colors.neutro400}
              multiline
              maxLength={500}
              onSubmitEditing={() => enviar(rascunho)}
              editable={!pensando}
            />
            <Pressable
              onPress={() => enviar(rascunho)}
              disabled={pensando || rascunho.trim().length === 0}
              accessibilityRole="button"
              accessibilityLabel="Enviar pergunta"
              style={[
                styles.enviar,
                (pensando || rascunho.trim().length === 0) && styles.enviarInativo,
              ]}
            >
              <Ionicons name="arrow-up" size={20} color={colors.neutro0} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // `overflow: 'hidden'` é requisito das manchas: as três sangram para fora da
  // tela de propósito, e sem o recorte a web ganha barra de rolagem lateral.
  container: { flex: 1, backgroundColor: colors.superficie, overflow: 'hidden' },
  // Mesma coluna de 480 da Home: sem isso a web estica a conversa de ponta a ponta.
  scroll: {
    paddingHorizontal: spacing.respiro,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    marginBottom: spacing.respiro,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  marca: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.rosa100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 17 no protótipo, contra o `h1` de 26 que estava aqui. O nome dela não é o
  // assunto da tela — a conversa é.
  titulo: { ...typography.tituloCard, fontSize: 17, color: colors.headline },
  acompanhando: { ...typography.itemRotulo, fontSize: 12, color: colors.neutro500 },

  // Centralizado como no protótipo: o vazio é a tela inteira, não um aviso
  // encostado à esquerda.
  vazio: { alignItems: 'center', gap: 10, paddingTop: 26 },
  circulo: {
    width: 150,
    height: 150,
    borderRadius: radius.full,
    backgroundColor: colors.rosa50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  vazioTitulo: { ...typography.h2, fontSize: 23, lineHeight: 28, color: colors.headline, textAlign: 'center' },
  // `maxWidth: 270` é do protótipo, e não é enfeite: sem ele a frase estica até
  // os 480 da coluna e vira uma linha longa e difícil de varrer com o olho.
  vazioTexto: {
    ...typography.saudacaoSub,
    lineHeight: 22,
    color: colors.neutro500,
    textAlign: 'center',
    maxWidth: 270,
  },
  sugestoes: { marginTop: spacing.md, gap: spacing.sm },
  sugestao: {
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.linha,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sugestaoTexto: { ...typography.body, color: colors.rosa700 },

  balao: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    maxWidth: '90%',
  },
  balaoMae: { backgroundColor: colors.rosa100, alignSelf: 'flex-end' },
  balaoNinna: { backgroundColor: colors.neutro0, alignSelf: 'flex-start' },
  textoMae: { ...typography.body, color: colors.headline },
  textoNinna: { ...typography.bodyLarge, color: colors.neutro600 },
  pensando: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  rodape: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    // O rodape fica FORA do scroll, entao a barra flutuante passaria por cima do
    // campo de digitar. A compensacao mora aqui, nao no scroll.
    paddingBottom: spacing.abaixoDaBarra,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  campo: {
    flex: 1,
    ...typography.bodyLarge,
    color: colors.headline,
    backgroundColor: colors.neutro0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.linha,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 120,
  },
  enviar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.rosa500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enviarInativo: { opacity: 0.4 },

  rodapeLimite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  limiteTexto: { ...typography.body, color: colors.neutro500, flex: 1 },
  verPlano: {
    flex: 1,
    backgroundColor: colors.rosa500,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  verPlanoTexto: { ...typography.label, fontSize: 15, color: colors.neutro0 },
});
