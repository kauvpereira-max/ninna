import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useBaby } from '../../src/contexts/BabyContext';
import { useRegistrosRecentes } from '../../src/hooks/useRegistrosRecentes';
import { usePadroes } from '../../src/hooks/usePadroes';
import { useContagensDeHoje } from '../../src/hooks/useContagensDeHoje';
import { useAgoraTick } from '../../src/hooks/useAgoraTick';
import { escolherInsight } from '../../src/lib/copyInsight';
import { CardInsight } from '../../src/components/CardInsight';
import { encerrarSono, resumirSonoEmAndamento } from '../../src/lib/registros';
import { formatarIdade, formatarIdadeCorrigida } from '../../src/lib/idade';
import { formatarMomento } from '../../src/lib/horario';
import { ItemRegistro } from '../../src/components/ItemRegistro';
import { ListaDeRegistros } from '../../src/components/ListaDeRegistros';
import { MiniStats } from '../../src/components/MiniStats';
import { CATEGORIAS_DA_HOME, CATEGORIAS_FORA_DA_HOME } from '../../src/theme/categorias';
import { colors, spacing, radius, typography, elevation } from '../../src/theme/tokens';

export default function HojeScreen() {
  const { nomeMae } = useAuth();
  const { bebeAtivo, bebes } = useBaby();
  const router = useRouter();
  const { registros, carregando, erro, recarregar } = useRegistrosRecentes(bebeAtivo?.id ?? null);
  const { padroes } = usePadroes(bebeAtivo?.id ?? null);
  const { contagens, prontas: contagensProntas } = useContagensDeHoje(bebeAtivo?.id ?? null);

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

  /**
   * O pill do bebê — canto direito do cabeçalho, como no protótipo.
   *
   * Só o avatar e a seta. O NOME saiu daqui e desceu para o subtítulo da
   * saudação: no protótipo o pill não carrega texto, e o nome do bebê continua
   * visível logo abaixo, além do card de monitoramento que o repete.
   */
  const pillDoBebe = (
    <View style={styles.pill}>
      <View style={styles.avatar}>
        <Text style={styles.avatarLetter}>{bebeAtivo.name.charAt(0).toUpperCase()}</Text>
      </View>
      {podeTrocar ? <Ionicons name="chevron-down" size={10} color={colors.neutro400} /> : null}
    </View>
  );

  const legendaDoBebe = idadeCorrigida
    ? `${bebeAtivo.name} · ${idade} · ${idadeCorrigida} corrigida`
    : `${bebeAtivo.name} · ${idade}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* O cabeçalho do protótipo: saudação grande à esquerda, pill do bebê à
            direita.

            A saudação vira o nome do BEBÊ quando não há nome da mãe — conta
            criada antes do D2 não tem a chave em user_metadata. Antes ela
            simplesmente sumia, o que agora deixaria o cabeçalho começando por um
            subtítulo solto. O título grande existe nos dois casos; o que muda é
            de quem é o nome nele. */}
        <View style={styles.header}>
          <View style={styles.headerTexto}>
            <Text style={styles.saudacao} numberOfLines={1}>
              {nomeMae ? `Oi, ${nomeMae}` : bebeAtivo.name}
            </Text>
            <Text style={styles.subtitulo} numberOfLines={1}>
              {legendaDoBebe}
            </Text>
          </View>

          {podeTrocar ? (
            <Pressable
              onPress={() => router.push('/bebes')}
              accessibilityRole="button"
              accessibilityLabel={`Trocar de bebê. Acompanhando ${bebeAtivo.name} agora.`}
            >
              {pillDoBebe}
            </Pressable>
          ) : (
            pillDoBebe
          )}
        </View>

        <CardInsight
          nomeBebe={bebeAtivo.name}
          texto={insight.texto}
          aprendendo={insight.aprendendo}
        />

        <Text style={styles.sectionLabel}>REGISTRAR</Text>
        <View style={styles.grid}>
          {CATEGORIAS_DA_HOME.map((c) => (
            <Pressable
              key={c.key}
              onPress={() => router.push(`/registro/${c.key}`)}
              accessibilityRole="button"
              accessibilityLabel={`Registrar ${c.label}`}
              style={styles.categoriaItem}
            >
              <View style={[styles.categoriaBadge, { backgroundColor: c.bg }]}>
                <Ionicons name={c.icon} size={26} color={c.tinta} />
              </View>
              <Text style={styles.categoriaLabel}>{c.label}</Text>
            </Pressable>
          ))}

          {/* O botão só existe enquanto houver tipo fora dos atalhos. A lista é
              derivada, então ele aparece com o primeiro e some com o último —
              sem ninguém lembrar de nenhum dos dois. */}
          {CATEGORIAS_FORA_DA_HOME.length > 0 ? (
            <Pressable
              onPress={() => router.push('/tipos')}
              accessibilityRole="button"
              accessibilityLabel="Ver mais tipos de registro"
              style={styles.categoriaItem}
            >
              <View style={[styles.categoriaBadge, styles.categoriaMais]}>
                <Ionicons name="add" size={30} color={colors.neutro0} />
              </View>
              <Text style={styles.categoriaLabel}>Mais</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Os três números de hoje. Só entram DEPOIS de a resposta chegar —
            três zeros antes disso a mãe lê como registro perdido, não como
            "ainda não perguntei". */}
        {contagensProntas ? <MiniStats contagens={contagens} /> : null}

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
          <ListaDeRegistros>
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
          </ListaDeRegistros>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.superficie },
  // maxWidth vale pra Home inteira, não só pro grid: na web o ScrollView ocupa a
  // janela toda e esticava header, card e lista de ponta a ponta. 480 é largura de
  // celular grande — a Home continua sendo uma coluna, mesmo num monitor.
  scroll: { paddingHorizontal: spacing.respiro, paddingVertical: spacing.lg, width: '100%', maxWidth: 480, alignSelf: 'center' },
  // `alignItems: 'flex-start'` e não `center`: o pill acompanha o TOPO do bloco
  // de texto. Centralizado, ele desce junto com o subtítulo e desalinha da
  // saudação, que é a linha que o olho usa como régua.
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: spacing.respiro,
  },
  // `flex: 1` para o `numberOfLines` ter contra o que truncar — sem isso o nome
  // longo empurraria o pill para fora da tela em vez de cortar.
  headerTexto: { flex: 1 },
  saudacao: { ...typography.saudacao, color: colors.headline },
  subtitulo: { ...typography.saudacaoSub, color: colors.neutro500 },
  // O pill: branco com borda própria, medidas literais do protótipo. O padding
  // assimétrico (5 à esquerda, 10 à direita) é o que centra opticamente o
  // conjunto avatar-seta dentro do redondo.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 5,
    paddingRight: 10,
    borderRadius: radius.full,
    backgroundColor: colors.neutro0,
    borderWidth: 1,
    borderColor: colors.linhaPill,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.amarelo200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { ...typography.label, color: colors.headline },
  // O visual do card de insight mudou-se pra src/components/CardInsight.tsx.
  sectionLabel: {
    ...typography.label,
    color: colors.neutro500,
    marginBottom: spacing.sm,
  },
  // 4 por linha, como o `repeat(4, 1fr)` do protótipo. Com o teto de 8 atalhos,
  // os 7 tipos mais o "+" caem em DUAS linhas cheias — antes eram 3 por linha e
  // a última ficava pela metade.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
    marginBottom: spacing.lg,
  },
  categoriaItem: { width: '25%', alignItems: 'center', gap: 9 },
  // 70px e redondo. Era 52 com raio 16 — o círculo grande é o item nº 2 da lista
  // de maior impacto do protótipo, e o que mais muda a silhueta da Home.
  categoriaBadge: {
    width: 70,
    height: 70,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // O "+" é o único item sólido do grid, e é onde o `coralAcao` estreia: no
  // protótipo ele tem cor cheia, ícone branco e sombra da própria cor.
  //
  // Ele deixou de ser um "···" cinza discreto. A leitura muda — antes dizia "tem
  // mais coisa aqui", agora convida. É o que o protótipo desenha.
  categoriaMais: {
    backgroundColor: colors.coralAcao,
    ...elevation.acaoCoral,
  },
  categoriaLabel: { ...typography.label, color: colors.neutro600, letterSpacing: 0 },
  vazioTexto: { ...typography.body, color: colors.neutro500 },
  avisoTexto: { ...typography.caption, color: colors.coral600, marginBottom: spacing.sm },
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
