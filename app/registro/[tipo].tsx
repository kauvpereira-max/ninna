import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBaby } from '../../src/contexts/BabyContext';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { ChipGroup } from '../../src/components/ChipGroup';
import { aplicarMascaraHora, horaAtual, horaParaData } from '../../src/lib/horario';
import { AVISO_AO_SALVAR_SINTOMA } from '../../src/lib/copySaude';
import { criarRegistro, iniciarSono } from '../../src/lib/registros';
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
 */

export default function RegistroScreen() {
  const { tipo } = useLocalSearchParams<{ tipo: string }>();
  const router = useRouter();
  const { bebeAtivo } = useBaby();

  const [valores, setValores] = useState<ValoresRegistro>({ hora: horaAtual() });
  const [erros, setErros] = useState<ErrosRegistro>({});
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sintomaSalvo, setSintomaSalvo] = useState(false);

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

    const novosErros = validarRegistro(tipo, valores, (texto) => horaParaData(texto) !== null);
    setErros(novosErros);
    setErroForm(null);
    if (Object.keys(novosErros).length > 0) return;

    // Já validada acima — o `as Date` é o que a validação acabou de garantir.
    const ocorridoEm = (horaParaData(valores.hora ?? '') as Date).toISOString();

    setSalvando(true);
    // Sono é o único que não passa pela escrita genérica: ele fica em aberto, e
    // a regra de "só um por vez" precisa consultar o banco antes de inserir.
    const { error } = SCHEMAS[tipo].emAberto
      ? await iniciarSono(bebeAtivo.id, ocorridoEm)
      : await criarRegistro(tipo, bebeAtivo.id, valores, ocorridoEm);
    setSalvando(false);

    if (error) {
      setErroForm(error);
      return;
    }

    // Sintoma é o único que não fecha sozinho: a mãe acabou de anotar algo que a
    // preocupa, e a linha do pediatra precisa de um instante de tela pra ser lida.
    if (tipo === 'sintoma') {
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
              <Text style={styles.subtitulo}>{schema.subtitulo}</Text>
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
              label={schema.acao}
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
