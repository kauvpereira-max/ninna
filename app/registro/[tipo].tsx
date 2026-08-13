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
import { ConfirmacaoPronto } from '../../src/components/ConfirmacaoPronto';
import { TextField } from '../../src/components/TextField';
import {
  RotuloCampo,
  CampoHora,
  EscolhaEmGrade,
  StepperNumero,
  CampoTextoLivre,
} from '../../src/components/CamposDoRegistro';
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
  faltaObrigatorio,
  mascaraNumero,
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
  const [pronto, setPronto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

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

  // Vem ANTES do `sintomaSalvo` só por ordem de leitura; os dois nunca são
  // verdadeiros ao mesmo tempo — o `salvar` escolhe um ou outro.
  if (pronto) {
    return <ConfirmacaoPronto onFim={fechar} />;
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

  /**
   * O toque no botão principal: VALIDA, e só então decide se salva ou confirma.
   *
   * A ordem importa. Confirmar primeiro e validar depois mostraria "confere
   * antes de salvar" sobre um formulário que vai reprovar — a mãe confirmaria
   * uma dose e receberia um erro de campo, sem entender qual das duas coisas
   * aconteceu.
   *
   * Editar NÃO pede confirmação: os tipos que confirmam são imutáveis, então
   * este caminho não existe para eles. Se um dia existir tipo que confirma e
   * pode ser editado, a decisão volta para cá.
   */
  function handleSalvar() {
    if (!ehTipoRegistro(tipo) || !bebeAtivo) return;

    const novosErros = validarRegistro(tipo, valores, (texto) => lerHora(texto) !== null);
    setErros(novosErros);
    setErroForm(null);
    if (Object.keys(novosErros).length > 0) return;

    if (SCHEMAS[tipo].confirmaAntesDeSalvar && !editando) {
      setConfirmando(true);
      return;
    }
    void salvar();
  }

  // A hora é lida de um jeito para criar e de outro para editar — ver o
  // cabeçalho. A validação usa a MESMA função que a gravação vai usar, senão
  // ela aprovaria um horário que a gravação não consegue montar.
  function lerHora(texto: string) {
    const dia = ocorridoEm ? new Date(ocorridoEm) : null;
    return dia ? horaNoDia(texto, dia) : horaParaData(texto);
  }

  async function salvar() {
    if (!ehTipoRegistro(tipo) || !bebeAtivo) return;

    // Já validado pelo `handleSalvar` — o `as Date` é o que ele garantiu.
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
      // Volta ao formulário: a mensagem fica visível ao lado dos campos, e ela
      // pode corrigir sem passar pela confirmação de novo às cegas.
      setConfirmando(false);
      setErroForm(error);
      return;
    }

    // Sintoma é o único que não fecha sozinho ao NASCER: a mãe acabou de anotar
    // algo que a preocupa, e a linha do pediatra precisa de um instante de tela
    // pra ser lida. Editando não: "Anotado." confirmaria um registro que já
    // existia, e a frase certa para o momento é nenhuma.
    //
    // ⚠️ E ele NÃO ganha o "Pronto": aquela tela sai sozinha em 1,2s, e esta
    // precisa ser lida. Confirmação que se dispensa sozinha por cima de copy de
    // saúde seria a linha do pediatra passando na frente da mãe.
    if (tipo === 'sintoma' && !editando) {
      setSintomaSalvo(true);
      return;
    }

    // Todo o resto ganha o "Pronto", que fecha sozinho e devolve para a Home.
    setPronto(true);
  }

  function desenhar(bruto: CampoSchema) {
    // Resolvido, e não cru: é o mesmo campo que a validação vai ler. Em sintoma
    // "Outro", a observação já chega aqui com o rótulo e a exigência trocados.
    const campo = resolverCampo(bruto, valores);
    const valor = valores[campo.chave] ?? '';
    const erro = erros[campo.chave];

    // O rótulo saiu de dentro de cada controle e virou peça própria: o
    // protótipo usa o MESMO rótulo (13/700) acima de todos, e tê-lo dentro de
    // cada um obrigaria os cinco a concordarem sobre ele para sempre.
    const rotulo = (
      <RotuloCampo texto={campo.rotulo} opcional={!campo.obrigatorio && campo.entrada !== 'hora'} />
    );

    if (campo.entrada === 'hora') {
      return (
        <View key={campo.chave}>
          {rotulo}
          <CampoHora
            valor={valor}
            onChange={(texto) => definir(campo.chave, aplicarMascaraHora(texto))}
            erro={erro}
          />
        </View>
      );
    }

    if (campo.entrada === 'escolha') {
      return (
        <View key={campo.chave}>
          {rotulo}
          <EscolhaEmGrade
            opcoes={campo.opcoes}
            valor={valores[campo.chave] ?? null}
            onChange={(escolhido) => definir(campo.chave, escolhido)}
            erro={erro}
          />
        </View>
      );
    }

    if (campo.entrada === 'numero') {
      // `passo` no schema é o que decide stepper ou campo — ver o comentário
      // dele. A tela não escolhe; ela obedece.
      if (campo.passo !== undefined) {
        return (
          <View key={campo.chave}>
            {rotulo}
            <StepperNumero
              valor={valor}
              // A MESMA máscara do campo digitado. O stepper agora aceita
              // teclado, e mandar o texto cru aqui abriria a porta que o campo
              // fechava: máscara que aceita o que a validação recusa.
              onChange={(v) => definir(campo.chave, mascaraNumero(v, campo))}
              passo={campo.passo}
              min={campo.min}
              max={campo.max}
              unidade={campo.unidade}
              erro={erro}
            />
          </View>
        );
      }
      return (
        <TextField
          key={campo.chave}
          label={campo.rotulo}
          value={valor}
          // A máscara mora no schema, não aqui: ela e a validação precisam
          // concordar sobre o que é um número válido. Máscara que aceita o que a
          // validação recusa é campo que reprova o que ele deixou escrever.
          onChangeText={(texto) => definir(campo.chave, mascaraNumero(texto, campo))}
          placeholder={campo.placeholder}
          // `decimal-pad` traz o separador; `number-pad` não tem, e num campo com
          // casas decimais ela não teria como digitar a vírgula.
          keyboardType={campo.decimais ? 'decimal-pad' : 'number-pad'}
          error={erro}
        />
      );
    }

    return (
      <View key={campo.chave}>
        {rotulo}
        <CampoTextoLivre
          valor={valor}
          onChange={(texto) => definir(campo.chave, texto)}
          placeholder={campo.placeholder ?? ''}
          erro={erro}
        />
      </View>
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

            {/* ------------------------------------------------------------
                A CONFIRMAÇÃO EM DUAS ETAPAS — só o grupo de saúde.

                Ela não é modal e não é `Alert`: o react-native-web não
                implementa `Alert.alert` com dois botões, e `window.confirm`
                bloqueia a página inteira. É o mesmo padrão inline do "apagar"
                da tela de detalhe, e funciona igual na web e no nativo.

                O formulário CONTINUA VISÍVEL acima dela. Uma confirmação que
                esconde o que está sendo confirmado não é confirmação — é um
                segundo toque. A mãe precisa poder reler a dose que digitou.
                ------------------------------------------------------------ */}
            {confirmando ? (
              <View style={styles.confirmacao}>
                <Text style={styles.confirmacaoTexto}>{schema.confirmaAntesDeSalvar}</Text>
                <Button
                  label={salvando ? 'Salvando…' : 'Confirmar e salvar'}
                  onPress={salvar}
                  loading={salvando}
                  style={{ marginTop: spacing.sm }}
                />
                <Button
                  label="Voltar e corrigir"
                  variant="secondary"
                  onPress={() => setConfirmando(false)}
                  disabled={salvando}
                  style={{ marginTop: spacing.sm }}
                />
              </View>
            ) : (
              <>
                <Button
                  label={editando ? 'Salvar alterações' : schema.acao}
                  onPress={handleSalvar}
                  loading={salvando}
                  // Nasce desabilitado enquanto faltar campo obrigatório, como
                  // no protótipo. Botão que parece ativo e recusa depois é pior
                  // que botão que diz "falta algo" antes de ser tocado.
                  disabled={faltaObrigatorio(tipo, valores)}
                  style={{ marginTop: spacing.sm }}
                />
                <Button
                  label="Cancelar"
                  variant="secondary"
                  onPress={fechar}
                  disabled={salvando}
                  style={{ marginTop: spacing.sm }}
                />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.superficie },
  /**
   * O `maxWidth` faltava AQUI, e só aqui — as outras dez telas do app já o
   * tinham. Sem ele o modal esticava de ponta a ponta: num monitor de 1536px o
   * CTA media 1488px.
   *
   * Era bug anterior aos blocos de fidelidade, mas o bloco 3 piorou o sintoma —
   * a sombra colorida de 20px de raio passou a acompanhar o botão por toda essa
   * largura, o que chama muito mais atenção que o rosa chapado de antes.
   */
  scroll: {
    paddingHorizontal: spacing.respiro,
    paddingVertical: spacing.lg,
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
  form: { marginTop: spacing.xl },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confirmacao: {
    marginTop: spacing.md,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  confirmacaoTexto: { ...typography.body, color: colors.neutro700 },
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
