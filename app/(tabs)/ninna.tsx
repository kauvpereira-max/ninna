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
import { useBaby } from '../../src/contexts/BabyContext';
import { perguntar } from '../../src/lib/assistente';
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
  const [falas, setFalas] = useState<Fala[]>([]);
  const [rascunho, setRascunho] = useState('');
  const [pensando, setPensando] = useState(false);
  const [semCota, setSemCota] = useState(false);
  const scroll = useRef<ScrollView>(null);

  async function enviar(texto: string) {
    const pergunta = texto.trim();
    if (!pergunta || pensando || semCota || !bebeAtivo) return;

    setFalas((atuais) => [...atuais, { de: 'mae', texto: pergunta }]);
    setRascunho('');
    setPensando(true);

    const resposta = await perguntar(pergunta, bebeAtivo.id);

    setFalas((atuais) => [...atuais, { de: 'ninna', texto: resposta.texto }]);
    setPensando(false);
    if (resposta.limite) setSemCota(true);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.scroll}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          <Text style={styles.titulo}>Ninna</Text>

          {falas.length === 0 ? (
            <View style={styles.vazio}>
              {/* Diz o que ela É antes de dizer o que perguntar. A mãe que espera
                  um chat sobre bebês vai se frustrar na primeira pergunta; a que
                  sabe que é sobre os registros dela, não. */}
              <Text style={styles.vazioTitulo}>
                Eu sei o que você registrou{bebeAtivo ? ` de ${bebeAtivo.name}` : ''}.
              </Text>
              <Text style={styles.vazioTexto}>
                Pergunta sobre horários, quantidades e o que vem se repetindo nos últimos dias.
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

        {semCota ? (
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
  container: { flex: 1, backgroundColor: colors.neutro50 },
  // Mesma coluna de 480 da Home: sem isso a web estica a conversa de ponta a ponta.
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  titulo: { ...typography.h1, color: colors.headline, marginBottom: spacing.lg },

  vazio: { gap: spacing.sm },
  vazioTitulo: { ...typography.bodyLarge, color: colors.headline, fontFamily: 'NunitoSans_600SemiBold' },
  vazioTexto: { ...typography.body, color: colors.neutro500 },
  sugestoes: { marginTop: spacing.md, gap: spacing.sm },
  sugestao: {
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutro100,
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
    borderColor: colors.neutro100,
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
});
