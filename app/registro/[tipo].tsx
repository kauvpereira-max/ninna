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
import {
  criarAmamentacao,
  criarFralda,
  criarHumor,
  criarMamadeira,
  criarSintoma,
  ehTipoRegistro,
  iniciarSono,
  HUMORES,
  INTENSIDADES,
  MOTIVOS_HUMOR,
  SINTOMAS,
  type TipoRegistro,
} from '../../src/lib/registros';
import type {
  ConteudoFralda,
  Humor,
  Intensidade,
  LadoSeio,
  TipoLeite,
} from '../../src/types/database';
import { colors, spacing, radius, typography } from '../../src/theme/tokens';

type Copy = { titulo: string; subtitulo: string; labelHora: string; acao: string };

const COPY: Record<TipoRegistro, Copy> = {
  amamentar: {
    titulo: 'Amamentação',
    subtitulo: 'Anota rapidinho — dá pra ajustar depois.',
    labelHora: 'Começou às',
    acao: 'Salvar mamada',
  },
  mamadeira: {
    titulo: 'Mamadeira',
    subtitulo: 'Anota rapidinho — dá pra ajustar depois.',
    labelHora: 'Começou às',
    acao: 'Salvar mamadeira',
  },
  fralda: {
    titulo: 'Troca de fralda',
    subtitulo: 'Um toque e já volto pra Home.',
    labelHora: 'Horário da troca',
    acao: 'Salvar troca',
  },
  sono: {
    titulo: 'Sono',
    subtitulo: 'Deixo o sono correndo a partir desse horário — você encerra na Home quando acabar.',
    labelHora: 'Começou às',
    acao: 'Começar sono',
  },
  humor: {
    titulo: 'Humor',
    subtitulo: 'O estado do momento. Não saber o motivo também é uma resposta.',
    labelHora: 'Horário',
    acao: 'Salvar humor',
  },
  sintoma: {
    titulo: 'Sintoma',
    subtitulo: 'Anotar ajuda a enxergar o padrão depois — aqui não é diagnóstico.',
    labelHora: 'Horário',
    acao: 'Salvar sintoma',
  },
};

const MAX_DURACAO_MIN = 180;

/** Único valor de `symptom` que aceita descrição da mãe — e ela vai em `notes`, não na coluna. */
const SINTOMA_OUTRO = 'other';

type CampoErro =
  | 'hora'
  | 'lado'
  | 'duracao'
  | 'quantidade'
  | 'leite'
  | 'conteudo'
  | 'humor'
  | 'sintoma'
  | 'descricao'
  | 'form';
type Erros = Partial<Record<CampoErro, string>>;

export default function RegistroScreen() {
  const { tipo } = useLocalSearchParams<{ tipo: string }>();
  const router = useRouter();
  const { bebeAtivo } = useBaby();

  const [hora, setHora] = useState(horaAtual());
  const [lado, setLado] = useState<LadoSeio | null>(null);
  const [duracao, setDuracao] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [leite, setLeite] = useState<TipoLeite | null>(null);
  const [conteudo, setConteudo] = useState<ConteudoFralda | null>(null);
  const [humor, setHumor] = useState<Humor | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [sintoma, setSintoma] = useState<string | null>(null);
  const [intensidade, setIntensidade] = useState<Intensidade | null>(null);
  const [observacao, setObservacao] = useState('');

  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [sintomaSalvo, setSintomaSalvo] = useState(false);

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

  const copy = COPY[tipo];

  if (sintomaSalvo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scroll}>
          <View style={styles.pediatraCard}>
            {/* Copy travada: não avalia gravidade, não sugere urgência, não cita
                número nem sinal de alarme, e não diz que "não é nada". O app
                registra e devolve a decisão pra mãe — ver CLAUDE.md. */}
            <Text style={styles.pediatraTexto}>
              Anotado. Se você estiver preocupada com isso, confie no seu instinto e fale com o
              pediatra — o Ninna acompanha, mas quem examina é ele.
            </Text>
          </View>

          <Button label="Fechar" onPress={fechar} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  async function handleSalvar() {
    if (!ehTipoRegistro(tipo) || !bebeAtivo) return;

    const novosErros: Erros = {};

    const momento = horaParaData(hora);
    if (!momento) novosErros.hora = 'Coloca no formato HH:MM, ex.: 14:20.';

    let duracaoSegundos: number | null = null;
    if (tipo === 'amamentar') {
      if (!lado) novosErros.lado = 'De qual lado foi?';
      if (duracao.trim()) {
        const minutos = Number(duracao);
        if (!Number.isFinite(minutos) || minutos < 1 || minutos > MAX_DURACAO_MIN) {
          novosErros.duracao = `Duração em minutos, de 1 a ${MAX_DURACAO_MIN}.`;
        } else {
          duracaoSegundos = minutos * 60;
        }
      }
    }

    let quantidadeMl = 0;
    if (tipo === 'mamadeira') {
      quantidadeMl = Number(quantidade);
      if (!quantidade.trim() || !Number.isFinite(quantidadeMl) || quantidadeMl < 5 || quantidadeMl > 500) {
        novosErros.quantidade = 'Quantidade em ml, ex.: 90.';
      }
      if (!leite) novosErros.leite = 'Era leite materno ou fórmula?';
    }

    if (tipo === 'fralda' && !conteudo) novosErros.conteudo = 'O que tinha na fralda?';

    if (tipo === 'humor' && !humor) novosErros.humor = 'Qual estado você percebeu?';

    if (tipo === 'sintoma') {
      if (!sintoma) novosErros.sintoma = 'O que você notou?';
      // Sem descrição, um registro 'other' não diz nada nem pra mãe nem pro motor.
      else if (sintoma === SINTOMA_OUTRO && !observacao.trim()) {
        novosErros.descricao = 'Me conta em poucas palavras o que você notou.';
      }
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const ocorridoEm = (momento as Date).toISOString();
    const notes = observacao.trim() ? observacao.trim() : null;

    setSalvando(true);
    let error: string | null = null;

    if (tipo === 'amamentar') {
      ({ error } = await criarAmamentacao(bebeAtivo.id, {
        side: lado as LadoSeio,
        duration_seconds: duracaoSegundos,
        started_at: ocorridoEm,
        notes,
      }));
    } else if (tipo === 'mamadeira') {
      ({ error } = await criarMamadeira(bebeAtivo.id, {
        amount_ml: quantidadeMl,
        bottle_type: leite as TipoLeite,
        started_at: ocorridoEm,
        notes,
      }));
    } else if (tipo === 'fralda') {
      ({ error } = await criarFralda(bebeAtivo.id, {
        content: conteudo as ConteudoFralda,
        recorded_at: ocorridoEm,
        notes,
      }));
    } else if (tipo === 'humor') {
      ({ error } = await criarHumor(bebeAtivo.id, {
        mood: humor as Humor,
        probable_reason: motivo,
        recorded_at: ocorridoEm,
        notes,
      }));
    } else if (tipo === 'sintoma') {
      // `symptom` só recebe slug da lista; o que a mãe escreveu fica em `notes`.
      ({ error } = await criarSintoma(bebeAtivo.id, {
        symptom: sintoma as string,
        intensity: intensidade,
        recorded_at: ocorridoEm,
        notes,
      }));
    } else {
      ({ error } = await iniciarSono(bebeAtivo.id, ocorridoEm));
    }

    setSalvando(false);

    if (error) {
      setErros({ form: error });
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titulo}>{copy.titulo}</Text>
              <Text style={styles.subtitulo}>{copy.subtitulo}</Text>
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
            <TextField
              label={copy.labelHora}
              value={hora}
              onChangeText={(texto) => setHora(aplicarMascaraHora(texto))}
              placeholder="HH:MM"
              keyboardType="number-pad"
              maxLength={5}
              error={erros.hora}
            />

            {tipo === 'amamentar' ? (
              <>
                <ChipGroup<LadoSeio>
                  label="Lado"
                  value={lado}
                  onChange={setLado}
                  options={[
                    { value: 'left', label: 'Esquerdo' },
                    { value: 'right', label: 'Direito' },
                    { value: 'both', label: 'Os dois' },
                  ]}
                  error={erros.lado}
                />
                <TextField
                  label="Duração em minutos (opcional)"
                  value={duracao}
                  onChangeText={(t) => setDuracao(t.replace(/\D/g, '').slice(0, 3))}
                  placeholder="ex.: 12"
                  keyboardType="number-pad"
                  error={erros.duracao}
                />
              </>
            ) : null}

            {tipo === 'mamadeira' ? (
              <>
                <TextField
                  label="Quantidade (ml)"
                  value={quantidade}
                  onChangeText={(t) => setQuantidade(t.replace(/\D/g, '').slice(0, 3))}
                  placeholder="ex.: 90"
                  keyboardType="number-pad"
                  error={erros.quantidade}
                />
                <ChipGroup<TipoLeite>
                  label="O que tinha na mamadeira"
                  value={leite}
                  onChange={setLeite}
                  options={[
                    { value: 'breast_milk', label: 'Leite materno' },
                    { value: 'formula', label: 'Fórmula' },
                  ]}
                  error={erros.leite}
                />
              </>
            ) : null}

            {tipo === 'fralda' ? (
              <ChipGroup<ConteudoFralda>
                label="O que tinha na fralda"
                value={conteudo}
                onChange={setConteudo}
                options={[
                  { value: 'pee', label: 'Xixi' },
                  { value: 'poop', label: 'Cocô' },
                  { value: 'both', label: 'Os dois' },
                ]}
                error={erros.conteudo}
              />
            ) : null}

            {tipo === 'humor' ? (
              <>
                {/* Substantivos, nunca adjetivos: o app não sabe o gênero do bebê. */}
                <ChipGroup<Humor>
                  label="Estado"
                  value={humor}
                  onChange={setHumor}
                  options={HUMORES}
                  error={erros.humor}
                />
                <ChipGroup<string>
                  label="O que pode ter causado (opcional)"
                  value={motivo}
                  onChange={setMotivo}
                  options={MOTIVOS_HUMOR}
                />
              </>
            ) : null}

            {tipo === 'sintoma' ? (
              <>
                <ChipGroup<string>
                  label="O que você notou"
                  value={sintoma}
                  onChange={setSintoma}
                  options={SINTOMAS}
                  error={erros.sintoma}
                />
                <ChipGroup<Intensidade>
                  label="Intensidade (opcional)"
                  value={intensidade}
                  onChange={setIntensidade}
                  options={INTENSIDADES}
                />
              </>
            ) : null}

            {/* sleep_records é a única tabela de registro sem coluna de observação.
                Em sintoma "Outro" esse mesmo campo vira a descrição — é o que vai
                pra `notes`, porque texto livre nunca entra na coluna `symptom`. */}
            {tipo !== 'sono' ? (
              <TextField
                label={
                  sintoma === SINTOMA_OUTRO && tipo === 'sintoma'
                    ? 'O que você notou?'
                    : 'Observação (opcional)'
                }
                value={observacao}
                onChangeText={setObservacao}
                placeholder={
                  sintoma === SINTOMA_OUTRO && tipo === 'sintoma'
                    ? 'Descreve com suas palavras'
                    : 'Algo que você queira lembrar depois'
                }
                maxLength={280}
                multiline
                error={erros.descricao}
              />
            ) : null}

            {erros.form ? <Text style={styles.erroForm}>{erros.form}</Text> : null}

            <Button
              label={copy.acao}
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
