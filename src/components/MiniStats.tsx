import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography, elevation } from '../theme/tokens';
import type { ContagensDeHoje } from '../lib/registros';

/**
 * Os três números de hoje: mamadas, sonecas e fraldas.
 *
 * ------------------------------------------------------------------
 * SÃO CONTAGENS, E ISSO É O QUE OS TORNA SEGUROS
 *
 * O protótipo desenha três mini-cards e não diz o que vai dentro. A escolha foi
 * contagem do dia — e ela não é só a mais fácil, é a única que não pede hedge.
 *
 * Um número contado é um fato dos registros dela: "6 fraldas" é verificável
 * olhando a Rotina. Já uma MÉDIA precisa dos três estados de confiança do
 * `padroes.ts`, e o `nao_se_aplica` existe justamente porque há conta que fecha
 * e não descreve nada. Média num card de três colunas, sem espaço para hedge,
 * seria a tese quebrada no lugar mais visível da Home.
 *
 * Por isso aqui não há adjetivo, não há comparação e não há "esperado". Só
 * quantos, de que, hoje.
 *
 * ------------------------------------------------------------------
 * O ZERO É NÚMERO LEGÍTIMO, MAS SÓ DEPOIS DE PERGUNTAR
 *
 * "0 sonecas" às 7h da manhã está correto e deve aparecer. O que não pode é
 * aparecer antes da resposta chegar — daí o `prontas` no hook, e não um
 * `!carregando`.
 */
type Props = { contagens: ContagensDeHoje };

export function MiniStats({ contagens }: Props) {
  return (
    <View style={styles.grid}>
      <Stat numero={contagens.mamadas} rotulo={contagens.mamadas === 1 ? 'mamada' : 'mamadas'} />
      <Stat numero={contagens.sonecas} rotulo={contagens.sonecas === 1 ? 'soneca' : 'sonecas'} />
      <Stat numero={contagens.fraldas} rotulo={contagens.fraldas === 1 ? 'fralda' : 'fraldas'} />
    </View>
  );
}

/**
 * O rótulo concorda com o número — "1 mamada", não "1 mamadas".
 *
 * Parece detalhe e não é: o app inteiro evita a linguagem de painel, e "1
 * mamadas" é exatamente o ruído de sistema que denuncia número gerado por
 * máquina. É a mesma disciplina do `copyInsight.ts`, num lugar bem menor.
 */
function Stat({ numero, rotulo }: { numero: number; rotulo: string }) {
  return (
    <View
      style={styles.card}
      accessibilityRole="text"
      accessibilityLabel={`${numero} ${rotulo} hoje`}
    >
      <Text style={styles.numero}>{numero}</Text>
      <Text style={styles.rotulo}>{rotulo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // `1fr 1fr 1fr` com gap 8, do protótipo — em RN, três `flex: 1` e o mesmo gap.
  grid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.respiro },
  card: {
    flex: 1,
    backgroundColor: colors.neutro0,
    borderRadius: radius.mini,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.linha,
    ...elevation.level1,
  },
  numero: { ...typography.numeroStat, color: colors.headline },
  rotulo: { ...typography.itemRotulo, color: colors.textoTerciario },
});
