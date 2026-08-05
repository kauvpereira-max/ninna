import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useBaby } from '../../src/contexts/BabyContext';
import { useRegistrosRecentes } from '../../src/hooks/useRegistrosRecentes';
import { useAgoraTick } from '../../src/hooks/useAgoraTick';
import { encerrarSono, resumirSonoEmAndamento } from '../../src/lib/registros';
import { formatarIdade, formatarIdadeCorrigida } from '../../src/lib/idade';
import { formatarMomento } from '../../src/lib/horario';
import { CATEGORIAS, CATEGORIA_POR_TIPO } from '../../src/theme/categorias';
import { colors, spacing, radius, typography, elevation } from '../../src/theme/tokens';

/**
 * No Safari do iPhone, segurar o dedo sobre um elemento dispara o callout do sistema
 * e a seleção de texto antes de qualquer handler do app. Sem isso, o long-press da
 * lista vira "copiar/compartilhar" do navegador em vez de atalho pra apagar.
 *
 * Só existe na web: no nativo essas propriedades não são estilo válido de RN, e o
 * gesto já se comporta como esperado.
 */
const semCalloutNaWeb =
  Platform.OS === 'web'
    ? ({ userSelect: 'none', WebkitTouchCallout: 'none' } as any)
    : null;

export default function HojeScreen() {
  const { nomeMae } = useAuth();
  const { bebeAtivo, bebes } = useBaby();
  const router = useRouter();
  const { registros, carregando, erro, recarregar } = useRegistrosRecentes(bebeAtivo?.id ?? null);

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

  // TODO: trocar por leitura real de baby_patterns quando o motor de personalização existir.
  // Enquanto não há registro nenhum, a Ninna não finge saber um padrão que ainda não aprendeu.
  // Construção sem artigo de gênero: `sex` é opcional no cadastro.
  const insight = `Ainda estou conhecendo a rotina de ${bebeAtivo.name} — os primeiros registros já começam a revelar o padrão.`;

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

        <View style={styles.monitorCard}>
          <View style={styles.monitorIconWrap}>
            <Ionicons name="moon" size={18} color={colors.coral500} />
          </View>
          <View style={{ flex: 1 }}>
            {/* Sem artigo antes do nome: `sex` é nullable e "DE A LIZ" não existe. */}
            <Text style={styles.monitorLabel}>A ROTINA DE {bebeAtivo.name.toUpperCase()}</Text>
            <Text style={styles.monitorText}>{insight}</Text>
          </View>
        </View>

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
            {registros.map((r) => {
              const visual = CATEGORIA_POR_TIPO[r.tipo];
              const abrir = () => router.push(`/detalhe/${r.tipo}/${r.id}`);
              return (
                // Tocar abre o detalhe, que é onde mora o botão de apagar. O long-press
                // leva ao mesmo lugar — é atalho, não o único caminho: no Safari do
                // iPhone ele é abafado pelo callout do sistema e no desktop nem existe.
                <Pressable
                  key={`${r.tipo}-${r.id}`}
                  onPress={abrir}
                  onLongPress={abrir}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir registro de ${visual.label}: ${r.resumo}`}
                  style={[styles.registroItem, semCalloutNaWeb]}
                >
                  <View style={[styles.registroBadge, { backgroundColor: visual.bg }]}>
                    <Ionicons name={visual.icon} size={15} color={colors.onDark} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.registroResumo, r.emAndamento && styles.registroAtivo]}>
                      {/* Sono aberto reconta no tick local; o resto vem pronto do fetch. */}
                      {r.emAndamento ? resumirSonoEmAndamento(r.ocorridoEm, agora) : r.resumo}
                    </Text>
                    <Text style={styles.registroCategoria}>{visual.label}</Text>
                  </View>

                  {r.emAndamento ? (
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
                  ) : (
                    <Text style={styles.registroHora}>{formatarMomento(r.ocorridoEm)}</Text>
                  )}
                </Pressable>
              );
            })}
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
  monitorCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.neutro800,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  monitorIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.noiteSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monitorLabel: { ...typography.caption, color: colors.coral500, fontFamily: 'NunitoSans_700Bold', marginBottom: 2 },
  monitorText: { ...typography.body, color: colors.onDark, fontFamily: 'NunitoSans_600SemiBold' },
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
  registroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...elevation.level1,
  },
  registroBadge: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registroResumo: { ...typography.body, color: colors.headline, fontFamily: 'NunitoSans_600SemiBold' },
  // Sono em andamento é timer ativo — um dos usos que o design system libera pro coral.
  registroAtivo: { color: colors.coral600 },
  registroCategoria: { ...typography.caption, color: colors.neutro400 },
  registroHora: { ...typography.caption, color: colors.neutro500 },
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
