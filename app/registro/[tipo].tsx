import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBaby } from '../../src/contexts/BabyContext';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { ChipGroup } from '../../src/components/ChipGroup';
import { aplicarMascaraHora, horaAtual, horaNoDia, horaParaData } from '../../src/lib/horario';
import { AVISO_AO_SALVAR_SINTOMA } from '../../src/lib/copySaude';
import {
  atualizarRegistro,
  carregarParaEdicao,
  criarRegistro,
  iniciarSono,
} from '../../src/lib/registros';
import {
  SCHEMAS,
  ehTipoRegistro,
  resolverCampo,
  validarRegistro,
  type CampoSchema,
  type ErrosRegistro,
  type ValoresRegistro,
} from '../../src/lib/registroSchema';
import { colors, spacing, radius, typography } from '../../src/theme/tokens';

/**
 * A tela de registro — uma só, para todos os tipos.
 *
 * Ela não conhece amamentação, fralda nem sintoma. O que ela sabe fazer é
 * desenhar os quatro tipos de campo que existem (hora, escolha, número, texto),
 * e quais campos aparecem vem do `registroSchema.ts`.
 *
 * A consequência é o ponto do bloco 2: somar um tipo de registro passa a ser
 * somar uma entrada no schema. Esta tela não muda, a validação não muda, a
 * escrita não muda — e nenhum dos três pode ser esquecido, porque nenhum dos
 * três é editado.
 *
 * A validação é a MESMA função do schema, não uma cópia com as mesmas regras.
 * Uma cópia divergiria no primeiro campo novo, e a mãe veria "opcional"
 * reprovando por obrigatório.
 *
 * ------------------------------------------------------------------
 * CRIAR E EDITAR SÃO A MESMA TELA
 *
 * Com `?id=`, ela abre o registro existente e salva por cima. Os campos, a
 * validação e as colunas são os mesmos — o que muda é o verbo e a âncora do
 * horário.
 *
 * A ÂNCORA É A PARTE PERIGOSA. Registrando, "HH:MM" é hoje (ou ontem, se o
 * horário ainda não chegou), porque a mãe anota o que acabou de acontecer.
 * Editando, "HH:MM" é o dia DO REGISTRO — senão abrir uma mamada do dia 9,
 * mexer nos minutos e salvar teleportaria o registro para hoje, sem aviso e sem
 * desfazer. Por isso `horaNoDia` existe separada de `horaParaData`.
 */

export default function RegistroScreen() {
  const { tipo, id } = useLocalSearchParams<{ tipo: string; id?: string }>();
  const editando = Boolean(id);
  const router = useRouter();
  const { bebeAtivo } = useBaby();

  const [valores, setValores] = useState<ValoresRegistro>({ hora: horaAtual() });
  /** O instante original — em edição, é ele que diz de que dia é o registro. */
  const [ocorridoEm, setOcorridoEm] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(Boolean(id));
  const [sumiu, setSumiu] = useState(false);
  const [erros, setErros] = useState<ErrosRegistro>({});
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sintomaSalvo, setSintomaSalvo] = useState(false);

  const abrir = useCallback(async () => {
    if (!id || !ehTipoRegistro(tipo)) return;
    const { data, error } = await carregarParaEdicao(tipo, id);
    setCarregando(false);
    if (error) return setErroForm(error);
    // Apagado noutro aparelho enquanto ela vinha até aqui.
    if (!data) return setSumiu(true);
    setValores(data.valores);
    setOcorridoEm(data.ocorridoEm);
  }, [id, tipo]);

  useEffect(() => {
    void abrir();
  }, [abrir]);

  function definir(chave: string, valor: string | null) {
    setValores((atuais) => ({ ...atuais, [chave]: valor }));
  }

  function fechar() {
    // Na web o modal é uma rota comum, e ela pode ser aberta direto pela URL —
    // aí não há histórico pra voltar.
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }

  if (!ehTipoRegistro(tipo) || !bebeAtivo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scroll}>
          <Text style={styles.titulo}>Esse registro não existe</Text>
          <Text style={styles.subtitulo}>Volta pra Home e escolhe um dos atalhos.</Text>
          <Button label="Voltar" onPress={fechar} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  const schema = SCHEMAS[tipo];

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.scroll, styles.centro]}>
          <ActivityIndicator size="small" color={colors.rosa500} />
        </View>
      </SafeAreaView>
    );
  }

  if (sumiu) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scroll}>
          <Text style={styles.titulo}>Esse registro não está mais aqui</Text>
          <Text style={styles.subtitulo}>Pode ter sido apagado noutro aparelho.</Text>
          <Button label="Voltar" onPress={fechar} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  if (sintomaSalvo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scroll}>
          <View style={styles.pediatraCard}>
            {/* Copy travada, e o texto NÃO mora aqui: ele vem de
                `src/lib/copySaude.ts`, que é onde a mesma promessa também
                alimenta a recusa do assistente. Dois literais soltos já tinham
                começado a divergir. */}
            <Text style={styles.pediatraTexto}>{AVISO_AO_SALVAR_SINTOMA}</Text>
          </View>

          <Button label="Fechar" onPress={fechar} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  async function handleSalvar() {
    if (!ehTipoRegistro(tipo) || !bebeAtivo) return;

    // A hora é lida de um jeito para criar e de outro para editar — ver o
    // cabeçalho. A validação usa a MESMA função que a gravação vai usar, senão
    // ela aprovaria um horário que a gravação não consegue montar.
    const dia = ocorridoEm ? new Date(ocorridoEm) : null;
    const lerHora = (texto: string) => (dia ? horaNoDia(texto, dia) : horaParaData(texto));

    const novosErros = validarRegistro(tipo, valores, (texto) => lerHora(texto) !== null);
    setErros(novosErros);
    setErroForm(null);
    if (Object.keys(novosErros).length > 0) return;

    // Já validado acima — o `as Date` é o que a validação acabou de garantir.
    const instante = (lerHora(valores.hora ?? '') as Date).toISOString();

    setSalvando(true);
    const { error } = id
      ? await atualizarRegistro(tipo, id, valores, instante)
      : // Sono é o único que não passa pela escrita genérica ao nascer: ele fica
        // em aberto, e a regra de "só um por vez" precisa consultar o banco.
        SCHEMAS[tipo].emAberto
        ? await iniciarSono(bebeAtivo.id, instante)
        : await criarRegistro(tipo, bebeAtivo.id, valores, instante);
    setSalvando(false);

    if (error) {
      setErroForm(error);
      return;
    }

    // Sintoma é o único que não fecha sozinho ao NASCER: a mãe acabou de anotar
    // algo que a preocupa, e a linha do pediatra precisa de um instante de tela
    // pra ser lida. Editando não: "Anotado." confirmaria um registro que já
    // existia, e a frase certa para o momento é nenhuma.
    if (tipo === 'sintoma' && !editando) {
      setSintomaSalvo(true);
      return;
    }

    // A Home recarrega os registros ao receber o foco de volta.
    fechar();
  }

  function desenhar(bruto: CampoSchema) {
    // Resolvido, e não cru: é o mesmo campo que a validação vai ler. Em sintoma
    // "Outro", a observação já chega aqui com o rótulo e a exigência trocados.
    const campo = resolverCampo(bruto, valores);
    const valor = valores[campo.chave] ?? '';
    const erro = erros[campo.chave];

    if (campo.entrada === 'hora') {
      return (
        <TextField
          key={campo.chave}
          label={campo.rotulo}
          value={valor}
          onChangeText={(texto) => definir(campo.chave, aplicarMascaraHora(texto))}
          placeholder="HH:MM"
          keyboardType="number-pad"
          maxLength={5}
          error={erro}
        />
      );
    }

    if (campo.entrada === 'escolha') {
      return (
        <ChipGroup<string>
          key={campo.chave}
          label={campo.rotulo}
          value={valores[campo.chave] ?? null}
          onChange={(escolhido) => definir(campo.chave, escolhido)}
          options={campo.opcoes}
          error={erro}
        />
      );
    }

    if (campo.entrada === 'numero') {
      return (
        <TextField
          key={campo.chave}
          label={campo.rotulo}
          value={valor}
          onChangeText={(texto) =>
            definir(campo.chave, texto.replace(/\D/g, '').slice(0, campo.digitos))
          }
          placeholder={campo.placeholder}
          keyboardType="number-pad"
          error={erro}
        />
      );
    }

    return (
      <TextField
        key={campo.chave}
        label={campo.rotulo}
        value={valor}
        onChangeText={(texto) => definir(campo.chave, texto)}
        placeholder={campo.placeholder}
        maxLength={campo.max}
        multiline={campo.linhas}
        error={erro}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titulo}>{schema.titulo}</Text>
              <Text style={styles.subtitulo}>
                {editando ? 'Ajusta o que precisar e salva.' : schema.subtitulo}
              </Text>
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

          <View style={styles.form}>
            {schema.campos.map(desenhar)}

            {erroForm ? <Text style={styles.erroForm}>{erroForm}</Text> : null}

            <Button
              label={editando ? 'Salvar alterações' : schema.acao}
              onPress={handleSalvar}
              loading={salvando}
              style={{ marginTop: spacing.sm }}
            />
            <Button
              label="Cancelar"
              variant="secondary"
              onPress={fechar}
              disabled={salvando}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutro50 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
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
  form: { marginTop: spacing.xl },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  erroForm: { ...typography.caption, color: colors.coral600, marginBottom: spacing.sm },
  // Superfície calma de propósito: coral aqui viraria alerta, e alarmar não é o papel.
  pediatraCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.rosa50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.rosa200,
    padding: spacing.lg,
  },
  pediatraTexto: { ...typography.bodyLarge, color: colors.headline },
});
