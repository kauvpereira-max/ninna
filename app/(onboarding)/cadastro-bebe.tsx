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
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useBaby } from '../../src/contexts/BabyContext';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { ChipGroup } from '../../src/components/ChipGroup';
import { idadeEmDias, parseDataLocal } from '../../src/lib/idade';
import type { Sexo } from '../../src/types/database';
import { colors, spacing, typography } from '../../src/theme/tokens';

// Sexo é opcional no schema — 'skip' vira null no banco.
type OpcaoSexo = Sexo | 'skip';
type OpcaoTempo = 'termo' | 'antes';

const MAX_IDADE_DIAS = 365 * 10; // guarda contra erro de digitação no ano

/** Vai formatando DD/MM/AAAA enquanto a mãe digita, sem exigir que ela digite as barras. */
function aplicarMascaraData(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/** 'DD/MM/AAAA' -> 'AAAA-MM-DD', ou null se a data não existe de verdade (ex.: 31/02). */
function dataParaISO(mascarada: string): string | null {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(mascarada);
  if (!partes) return null;

  const [, dd, mm, aaaa] = partes;
  const dia = Number(dd);
  const mes = Number(mm);
  const ano = Number(aaaa);

  // O Date normaliza data inválida (31/02 vira 03/03), então conferimos de volta.
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return null;
  }
  return `${aaaa}-${mm}-${dd}`;
}

type Erros = Partial<Record<'nome' | 'nascimento' | 'semanas' | 'peso' | 'altura' | 'form', string>>;

/**
 * 'onboarding' é a conta sem nenhum bebê — o RootNavigator manda pra cá e leva pras
 * tabs sozinho quando o cadastro entra. 'adicional' é a mãe que já tem bebê e veio
 * pelo seletor (rota /bebes/novo): aí não há redirect automático, e a saída é daqui.
 */
type ContextoCadastro = 'onboarding' | 'adicional';

export default function CadastroBebeScreen({
  contexto = 'onboarding',
}: {
  contexto?: ContextoCadastro;
}) {
  const { cadastrarBebe } = useBaby();
  const { signOut } = useAuth();
  const router = useRouter();

  const adicional = contexto === 'adicional';

  const [nome, setNome] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [sexo, setSexo] = useState<OpcaoSexo | null>(null);
  const [tempo, setTempo] = useState<OpcaoTempo>('termo');
  const [semanasAntes, setSemanasAntes] = useState('');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');

  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);

  async function handleSalvar() {
    const novosErros: Erros = {};

    const nomeLimpo = nome.trim();
    if (!nomeLimpo) novosErros.nome = 'Conta pra mim como ele ou ela se chama.';

    const nascimentoISO = dataParaISO(nascimento);
    if (!nascimento.trim()) {
      novosErros.nascimento = 'Preciso da data de nascimento pra acompanhar a rotina.';
    } else if (!nascimentoISO) {
      novosErros.nascimento = 'Essa data não parece existir — confere pra mim?';
    } else {
      const agora = new Date();
      const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      if (parseDataLocal(nascimentoISO).getTime() > hoje.getTime()) {
        novosErros.nascimento = 'Essa data ainda está no futuro.';
      } else if (idadeEmDias(nascimentoISO, agora) > MAX_IDADE_DIAS) {
        novosErros.nascimento = 'Essa data ficou bem distante — confere o ano?';
      }
    }

    let semanas: number | null = null;
    if (tempo === 'antes') {
      semanas = Number(semanasAntes);
      if (!semanasAntes.trim() || !Number.isFinite(semanas) || semanas < 1 || semanas > 20) {
        novosErros.semanas = 'Quantas semanas antes? (entre 1 e 20)';
      }
    }

    let pesoG: number | null = null;
    if (peso.trim()) {
      pesoG = Number(peso.replace(/\D/g, ''));
      if (!pesoG || pesoG < 300 || pesoG > 8000) novosErros.peso = 'Peso em gramas, ex.: 3450.';
    }

    let alturaCm: number | null = null;
    if (altura.trim()) {
      alturaCm = Number(altura.replace(',', '.'));
      if (!Number.isFinite(alturaCm) || alturaCm < 20 || alturaCm > 70) {
        novosErros.altura = 'Altura em centímetros, ex.: 49.';
      }
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setSalvando(true);
    const { error } = await cadastrarBebe({
      name: nomeLimpo,
      birth_date: nascimentoISO as string,
      sex: sexo === 'F' || sexo === 'M' ? sexo : null,
      premature: tempo === 'antes',
      weeks_early: tempo === 'antes' ? semanas : null,
      weight_at_birth_g: pesoG,
      height_at_birth_cm: alturaCm,
    });
    setSalvando(false);

    if (error) {
      setErros({ form: error });
      return;
    }

    // Os dois caminhos terminam nas tabs: no onboarding o RootNavigator leva sozinho
    // assim que existe bebê ativo, e vindo do seletor a saída é esta.
    if (adicional) router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>
            {adicional ? 'Quem mais vamos acompanhar?' : 'Quem vamos acompanhar?'}
          </Text>
          <Text style={styles.subtitle}>
            {adicional
              ? 'Cada bebê tem o próprio ritmo — vou aprender esse do zero, sem misturar com o outro.'
              : 'Só o começo — com esses dados eu já consigo aprender o ritmo do seu bebê.'}
          </Text>

          <View style={styles.form}>
            <TextField
              label="Nome"
              value={nome}
              onChangeText={setNome}
              placeholder="Como você chama ele ou ela"
              autoCapitalize="words"
              error={erros.nome}
            />

            <TextField
              label="Data de nascimento"
              value={nascimento}
              onChangeText={(texto) => setNascimento(aplicarMascaraData(texto))}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              maxLength={10}
              error={erros.nascimento}
            />

            <ChipGroup<OpcaoSexo>
              label="Sexo"
              value={sexo}
              onChange={setSexo}
              options={[
                { value: 'F', label: 'Menina' },
                { value: 'M', label: 'Menino' },
                { value: 'skip', label: 'Prefiro não dizer' },
              ]}
            />

            <ChipGroup<OpcaoTempo>
              label="Nasceu no tempo previsto?"
              value={tempo}
              onChange={setTempo}
              options={[
                { value: 'termo', label: 'Sim, no tempo' },
                { value: 'antes', label: 'Chegou antes' },
              ]}
            />

            {tempo === 'antes' ? (
              <TextField
                label="Quantas semanas antes"
                value={semanasAntes}
                onChangeText={(t) => setSemanasAntes(t.replace(/\D/g, '').slice(0, 2))}
                placeholder="ex.: 6"
                keyboardType="number-pad"
                error={erros.semanas}
              />
            ) : null}

            <Text style={styles.opcionalLabel}>OPCIONAL — DÁ PRA PREENCHER DEPOIS</Text>

            <TextField
              label="Peso ao nascer (g)"
              value={peso}
              onChangeText={(t) => setPeso(t.replace(/\D/g, '').slice(0, 4))}
              placeholder="ex.: 3450"
              keyboardType="number-pad"
              error={erros.peso}
            />

            <TextField
              label="Altura ao nascer (cm)"
              value={altura}
              onChangeText={(t) => setAltura(t.replace(/[^\d,.]/g, '').slice(0, 5))}
              placeholder="ex.: 49"
              keyboardType="decimal-pad"
              error={erros.altura}
            />

            {erros.form ? <Text style={styles.errorText}>{erros.form}</Text> : null}

            <Button
              label={adicional ? 'Salvar bebê' : 'Salvar e continuar'}
              onPress={handleSalvar}
              loading={salvando}
              style={{ marginTop: spacing.sm }}
            />

            {adicional ? (
              <Button
                label="Cancelar"
                variant="secondary"
                onPress={() => router.replace('/(tabs)')}
                disabled={salvando}
                style={{ marginTop: spacing.sm }}
              />
            ) : null}
          </View>

          {/* Trocar de conta só faz sentido pra quem ainda não entrou no app. */}
          {adicional ? null : (
            <Pressable onPress={signOut} style={styles.sair}>
              <Text style={styles.sairTexto}>Entrar com outra conta</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutro50 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.h1, color: colors.headline, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.neutro500 },
  form: { marginTop: spacing.xl },
  opcionalLabel: {
    ...typography.label,
    fontSize: 11,
    color: colors.neutro400,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: { ...typography.caption, color: colors.coral600, marginBottom: spacing.sm },
  sair: { marginTop: spacing.xl, alignSelf: 'center' },
  sairTexto: { ...typography.body, color: colors.rosa700, fontFamily: 'NunitoSans_600SemiBold' },
});
