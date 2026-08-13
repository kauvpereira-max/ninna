import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme/tokens';

/**
 * Os controles do modal de registro, no desenho do protótipo.
 *
 * ------------------------------------------------------------------
 * SÃO GENÉRICOS DE PROPÓSITO — COBREM OS 19 TIPOS
 *
 * O protótipo tem `<!-- MODAL: GENÉRICO -->` ao lado dos cinco por tipo, e o app
 * medido diz que os quatro controles daqui cobrem **19 de 19**: hora em 19
 * campos, escolha em 14, número em 13, texto em 21. Nenhum tipo pede um quinto.
 *
 * As duas exceções reais são Sono e Amamentar, e as duas por cronômetro.
 *
 * ------------------------------------------------------------------
 * ⚠️ A ESCOLHA COM ÍCONE DO PROTÓTIPO NÃO PÔDE SER COPIADA
 *
 * A Fralda dele é uma grade de 3 colunas com círculo pastel de 48px e arte
 * própria por opção. **As opções do schema são `{ value, label }` — não há
 * ícone.** Copiá-la exigiria desenhar arte para cada opção de cada um dos 14
 * campos de escolha.
 *
 * E ela não generalizaria mesmo assim: os campos de escolha do app têm de 2 a 8
 * opções, e a grade de 3 é desenhada para exatamente três.
 *
 * O que ficou é o padrão do **Humor** — pílulas de 48px — com o número de
 * colunas derivado da contagem. É o mesmo protótipo, no controle que ele mesmo
 * usa quando a opção é só texto.
 */

/** O rótulo de campo: 13/700, com o "· opcional" em 600 mais claro. */
export function RotuloCampo({ texto, opcional }: { texto: string; opcional?: boolean }) {
  return (
    <Text style={estilos.rotulo}>
      {texto}
      {opcional ? <Text style={estilos.rotuloOpcional}> · opcional</Text> : null}
    </Text>
  );
}

/**
 * Hora — card branco com ícone, e o texto É editável.
 *
 * O protótipo mostra "Hoje, 11:05" como texto fixo, porque lá é maquete. Aqui
 * ele continua sendo campo de máscara: `datetimepicker` quebra o
 * `expo export --platform web`, que é como este projeto valida build.
 */
export function CampoHora({
  valor,
  onChange,
  erro,
}: {
  valor: string;
  onChange: (t: string) => void;
  erro?: string;
}) {
  return (
    <>
      <View style={[estilos.cartao, erro ? estilos.cartaoComErro : null]}>
        <Ionicons name="time-outline" size={18} color={colors.rosa700} />
        <TextInput
          value={valor}
          onChangeText={onChange}
          placeholder="HH:MM"
          placeholderTextColor={colors.neutro300}
          keyboardType="number-pad"
          maxLength={5}
          style={estilos.horaTexto}
        />
      </View>
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
    </>
  );
}

/**
 * Escolha — pílulas de 48px em grade.
 *
 * As colunas saem da contagem: até 3 opções cabem numa linha; a partir daí, 2
 * colunas, que é o que o Humor do protótipo faz com 6.
 */
export function EscolhaEmGrade({
  opcoes,
  valor,
  onChange,
  erro,
}: {
  opcoes: { value: string; label: string }[];
  valor: string | null;
  onChange: (v: string) => void;
  erro?: string;
}) {
  const colunas = opcoes.length <= 3 ? opcoes.length : 2;
  return (
    <>
      <View style={estilos.grade}>
        {opcoes.map((o) => {
          const ativo = valor === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
              style={[
                estilos.pilula,
                { width: `${100 / colunas}%` },
                ativo ? estilos.pilulaAtiva : null,
              ]}
            >
              <Text style={[estilos.pilulaTexto, ativo ? estilos.pilulaTextoAtivo : null]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
    </>
  );
}

/**
 * Número com stepper — só onde o schema declara `passo`.
 *
 * Sete campos ganham (mL de 10 em 10, minutos de 5 em 5) e seis continuam
 * digitados: peso vai de 0,5 a 30 e dose de 0,1 a 1000, e andar de 10 em 10 ali
 * não é impreciso, é inútil. Quem decide é o schema, não esta tela.
 */
export function StepperNumero({
  valor,
  onChange,
  passo,
  min,
  max,
  unidade,
  erro,
}: {
  valor: string;
  onChange: (v: string) => void;
  passo: number;
  min: number;
  max: number;
  unidade?: string;
  erro?: string;
}) {
  // Vazio conta como o mínimo para o primeiro toque no "+" dar um valor útil, e
  // não `passo` sozinho — 10 mL não é uma mamadeira.
  const atual = valor.trim() === '' ? min : Number(valor.replace(',', '.'));
  const seguro = Number.isFinite(atual) ? atual : min;

  const andar = (delta: number) => {
    const novo = Math.min(max, Math.max(min, seguro + delta));
    onChange(String(novo));
  };

  return (
    <>
      <View style={estilos.stepper}>
        <Pressable
          onPress={() => andar(-passo)}
          accessibilityRole="button"
          accessibilityLabel={`Diminuir ${passo}`}
          style={estilos.stepperMenos}
        >
          <Ionicons name="remove" size={18} color={colors.rosa700} />
        </Pressable>

        <View style={estilos.stepperValor}>
          <Text style={estilos.stepperNumero}>{valor.trim() === '' ? min : valor}</Text>
          {unidade ? <Text style={estilos.stepperUnidade}>{unidade}</Text> : null}
        </View>

        <Pressable
          onPress={() => andar(passo)}
          accessibilityRole="button"
          accessibilityLabel={`Aumentar ${passo}`}
          style={estilos.stepperMais}
        >
          <Ionicons name="add" size={18} color={colors.neutro0} />
        </Pressable>
      </View>
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
    </>
  );
}

/** Texto livre — o `textarea` do genérico. */
export function CampoTextoLivre({
  valor,
  onChange,
  placeholder,
  erro,
}: {
  valor: string;
  onChange: (t: string) => void;
  placeholder: string;
  erro?: string;
}) {
  return (
    <>
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.neutro300}
        multiline
        numberOfLines={3}
        style={[estilos.area, erro ? estilos.cartaoComErro : null]}
      />
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
    </>
  );
}

const estilos = StyleSheet.create({
  rotulo: {
    ...typography.label,
    fontFamily: 'NunitoSans_700Bold',
    color: colors.neutro600,
    letterSpacing: 0,
    marginBottom: spacing.sm,
  },
  rotuloOpcional: { fontFamily: 'NunitoSans_600SemiBold', color: colors.textoTerciario },

  // A sombra é a `0 2px 10px` do modal GENÉRICO, e a escolha é deliberada: o
  // protótipo é inconsistente aqui — usa `0 1px 3px` na Fralda e na Mamadeira e
  // `0 2px 10px` no Humor e no genérico, para o MESMO card de hora. Copiar as
  // duas deixaria o app inconsistente por herança.
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.respiro,
  },
  cartaoComErro: { borderWidth: 1.5, borderColor: colors.coral600 },
  horaTexto: { flex: 1, ...typography.itemDetalhe, fontSize: 15.5, color: colors.headline },

  grade: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.respiro },
  pilula: {
    height: 48,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.rosa200,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    // O gap do protótipo (10px) vira margem, porque a largura em % já divide a
    // linha — `gap` somado a `width:50%` estouraria a segunda coluna.
    marginBottom: 10,
  },
  pilulaAtiva: { backgroundColor: colors.rosa100, borderColor: colors.rosa500 },
  pilulaTexto: { ...typography.itemDetalhe, fontSize: 14.5, color: colors.neutro500 },
  pilulaTextoAtivo: { color: colors.rosa700 },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutro0,
    borderRadius: radius.card,
    padding: 18,
    marginBottom: spacing.respiro,
  },
  stepperMenos: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.rosa200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperMais: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.rosa500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValor: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  stepperNumero: { ...typography.display, fontSize: 40, letterSpacing: -1, color: colors.headline },
  stepperUnidade: { ...typography.label, fontFamily: 'NunitoSans_700Bold', fontSize: 15, color: colors.neutro500 },

  area: {
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.rosa300,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: 88,
    textAlignVertical: 'top',
    ...typography.itemDetalhe,
    fontSize: 15,
    color: colors.headline,
    marginBottom: spacing.respiro,
  },

  erro: { ...typography.itemRotulo, color: colors.coral600, marginTop: -spacing.md, marginBottom: spacing.md },
});
