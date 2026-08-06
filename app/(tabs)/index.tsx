import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useBaby } from '../../src/contexts/BabyContext';
import { useRegistrosRecentes } from '../../src/hooks/useRegistrosRecentes';
import { usePadroes } from '../../src/hooks/usePadroes';
import { useAgoraTick } from '../../src/hooks/useAgoraTick';
import { escolherInsight } from '../../src/lib/copyInsight';
import { CardInsight } from '../../src/components/CardInsight';
import { encerrarSono, resumirSonoEmAndamento } from '../../src/lib/registros';
import { formatarIdade, formatarIdadeCorrigida } from '../../src/lib/idade';
import { formatarMomento } from '../../src/lib/horario';
import { ItemRegistro } from '../../src/components/ItemRegistro';
import { CATEGORIAS } from '../../src/theme/categorias';
import { colors, spacing, radius, typography, elevation } from '../../src/theme/tokens';

export default function HojeScreen() {
  const { nomeMae } = useAuth();
  const { bebeAtivo, bebes } = useBaby();
  const router = useRouter();
  const { registros, carregando, erro, recarregar } = useRegistrosRecentes(bebeAtivo?.id ?? null);
  const { padroes } = usePadroes(bebeAtivo?.id ?? null);

  const [encerrandoId, setEncerrandoId] = useState<string | null>(null);
  const [erroEncerrar, setErroEncerrar] = useState<string | null>(null);

  // Só existe relógio correndo quando há sono aberto na lista.
  const temSonoAberto = registros.some((r) => r.emAndamento);
  const agora = useAgoraTick(temSonoAberto);

  // O RootNavigator só deixa chegar aqui com bebê carregado, mas o primeiro frame
  // da troca de rota pode passar por aqui antes do redirect.
  if (!bebeAtivo) return null;

  const idadeCorrigida = formatarIdadeCorrigida(bebeAtivo);
  const idade = formatarIdade(bebeAtivo.birth_date);

  // Com um bebê só não existe troca: nada de chevron, nada de alvo de toque.
  // Mãe de primeira viagem não precisa descobrir que aquilo ali não faz nada.
  const podeTrocar = bebes.length > 1;

  // O motor roda no cliente (BETA.md §3.2) — não há leitura de `baby_patterns`.
  // Enquanto ele não tiver do que falar, a Ninna diz que ainda está conhecendo,
  // em vez de fingir um padrão que não aprendeu.
  const insight = escolherInsight(padroes, bebeAtivo.name);

  async function handleEncerrarSono(sonoId: string) {
    setEncerrandoId(sonoId);
    setErroEncerrar(null);

    const { error } = await encerrarSono(sonoId);
    setEncerrandoId(null);

    if (error) {
      setErroEncerrar(error);
      return;
    }
    await recarregar();
  }

  // O conteúdo é o mesmo nos dois casos; o que muda é ser tocável ou não.
  const conteudoHeader = (
    <>
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{bebeAtivo.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.nome}>{bebeAtivo.name}</Text>
          <Text style={styles.idade}>
            {idadeCorrigida ? `${idade} · ${idadeCorrigida} corrigida` : idade}
          </Text>
        </View>
      </View>
      {podeTrocar ? <Ionicons name="chevron-down" size={18} color={colors.neutro400} /> : null}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* A saudação some quando não há nome, em vez de virar "Oi," pendurado: conta
            criada antes do D2 não tem a chave em user_metadata. O nome é da mãe; o
            resto da Home é do bebê, e é por isso que a saudação é discreta e ele não. */}
        {nomeMae ? <Text style={styles.saudacao}>Oi, {nomeMae}</Text> : null}

        {podeTrocar ? (
          <Pressable
            onPress={() => router.push('/bebes')}
            accessibilityRole="button"
            accessibilityLabel={`Trocar de bebê. Acompanhando ${bebeAtivo.name} agora.`}
            style={styles.header}
          >
            {conteudoHeader}
          </Pressable>
        ) : (
          <View style={styles.header}>{conteudoHeader}</View>
        )}

        <CardInsight
          nomeBebe={bebeAtivo.name}
          texto={insight.texto}
          aprendendo={insight.aprendendo}
        />

        <Text style={styles.sectionLabel}>REGISTRAR</Text>
        <View style={styles.grid}>
          {CATEGORIAS.map((c) => (
            <Pressable
              key={c.key}
              onPress={() => router.push(`/registro/${c.key}`)}
              accessibilityRole="button"
              accessibilityLabel={`Registrar ${c.label}`}
              style={styles.categoriaItem}
            >
              <View style={[styles.categoriaBadge, { backgroundColor: c.bg }]}>
                <Ionicons name={c.icon} size={22} color={colors.onDark} />
              </View>
              <Text style={styles.categoriaLabel}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>ÚLTIMOS REGISTROS</Text>

        {erro ? <Text style={styles.avisoTexto}>{erro}</Text> : null}
        {erroEncerrar ? <Text style={styles.avisoTexto}>{erroEncerrar}</Text> : null}

        {registros.length === 0 ? (
          carregando ? null : (
            <Text style={styles.vazioTexto}>
              Nenhum registro ainda — toque num atalho acima pra começar.
            </Text>
          )
        ) : (
          <View style={styles.lista}>
            {registros.map((r) => (
              <ItemRegistro
                key={`${r.tipo}-${r.id}`}
                registro={r}
                // Na Home o tempo é relativo ("ontem 23:50"); na Rotina o dia já
                // vem no cabeçalho do grupo, então lá basta a hora.
                horaLabel={formatarMomento(r.ocorridoEm)}
                // Sono aberto reconta no tick local; o resto vem pronto do fetch.
                resumo={r.emAndamento ? resumirSonoEmAndamento(r.ocorridoEm, agora) : undefined}
                onPress={() => router.push(`/detalhe/${r.tipo}/${r.id}`)}
                acao={
                  r.emAndamento ? (
                    <Pressable
                      onPress={() => handleEncerrarSono(r.id)}
                      disabled={encerrandoId === r.id}
                      accessibilityRole="button"
                      style={[styles.encerrar, encerrandoId === r.id && styles.encerrarOcupado]}
                    >
                      <Text style={styles.encerrarLabel}>
                        {encerrandoId === r.id ? 'Encerrando…' : 'Encerrar'}
                      </Text>
                    </Pressable>
                  ) : undefined
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutro50 },
  // maxWidth vale pra Home inteira, não só pro grid: na web o ScrollView ocupa a
  // janela toda e esticava header, card e lista de ponta a ponta. 480 é largura de
  // celular grande — a Home continua sendo uma coluna, mesmo num monitor.
  scroll: { padding: spacing.lg, width: '100%', maxWidth: 480, alignSelf: 'center' },
  saudacao: { ...typography.body, color: colors.neutro500, marginBottom: spacing.xs },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.amarelo200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { ...typography.label, color: colors.headline },
  nome: { ...typography.h3, color: colors.headline },
  idade: { ...typography.caption, color: colors.neutro500 },
  // O visual do card de insight mudou-se pra src/components/CardInsight.tsx.
  sectionLabel: {
    ...typography.label,
    color: colors.neutro500,
    marginBottom: spacing.sm,
  },
  // 3 por linha com wrap: 6 itens caem em 2 linhas certinhas e um 7º tipo entraria
  // sem mexer aqui. O `space-between` anterior espalhava os itens pela largura toda.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
    marginBottom: spacing.lg,
  },
  categoriaItem: { width: '33.333%', alignItems: 'center', gap: 4 },
  categoriaBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.level1,
  },
  categoriaLabel: { ...typography.caption, color: colors.headline },
  vazioTexto: { ...typography.body, color: colors.neutro500 },
  avisoTexto: { ...typography.caption, color: colors.coral600, marginBottom: spacing.sm },
  lista: { gap: spacing.sm },
  // O visual do item da lista mudou-se pra src/components/ItemRegistro.tsx, que a
  // Home e a Rotina compartilham.
  encerrar: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.rosa200,
  },
  encerrarOcupado: { opacity: 0.5 },
  encerrarLabel: { ...typography.caption, color: colors.rosa700, fontFamily: 'NunitoSans_600SemiBold' },
});
