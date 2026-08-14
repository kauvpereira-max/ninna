import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../theme/tokens';
import { formatarDuracaoMin } from '../lib/horario';

/**
 * O anel do modal de Sono — visual, e só.
 *
 * ------------------------------------------------------------------
 * ELE CONTA DESDE O HORÁRIO ESCOLHIDO, NÃO DO ZERO
 *
 * Quando este modal abre, não há sono correndo — ele é a tela de COMEÇAR. Um
 * anel de 216px parado em `00:00` seria forma sem função, que é o critério que
 * já recusou o overlay de 78%.
 *
 * Contando desde a hora do campo, ele diz algo verdadeiro e útil: *"o sono que
 * você está prestes a registrar já está correndo há 14 minutos"*. A mãe marca
 * 17:26 às 17:40 porque o bebê dormiu e ela só agora pegou o celular.
 *
 * ------------------------------------------------------------------
 * ⚠️ NÃO EXISTE STOP AQUI, E ISSO É A DECISÃO
 *
 * O encerrar mora na Home, e só lá. Dois lugares para encerrar produzem o estado
 * dividido — quem é o dono do "correndo" — que é como reaparece o "começou e
 * nunca encerrou".
 *
 * O subtítulo publicado já promete isso com todas as letras: *"você encerra na
 * Home quando acabar"*.
 *
 * ------------------------------------------------------------------
 * E NÃO HÁ ARCO DE PROGRESSO
 *
 * O protótipo desenha um arco com `stroke-dasharray`. Progresso rumo a quê? Sono
 * não tem duração-alvo — o arco mediria uma meta que não existe, e desenhar meta
 * de sono é a Ninna opinando sobre quanto o bebê devia dormir.
 *
 * Sem o arco, o anel é um trilho: `View` com borda de 12px.
 *
 * ⚠️ **O `react-native-svg` ENTROU em 14/08/2026**, pelos ícones dos tipos — e o
 * arco continua fora. A falta da biblioteca era o motivo SECUNDÁRIO; o primeiro
 * não mudou, e não é técnico.
 *
 * Quem vir a dependência instalada e concluir que "só faltava ela" vai
 * reintroduzir uma barra de progresso rumo a uma meta que a Ninna não tem — e
 * meta de sono desenhada na tela é a Ninna opinando sobre quanto o bebê devia
 * dormir, que é a tese ao contrário.
 */
export function AnelDoSono({ minutos }: { minutos: number | null }) {
  return (
    <View style={estilos.centro}>
      <View style={estilos.anel}>
        <Text style={estilos.tempo}>{minutos === null ? '--' : formatarDuracaoMin(minutos)}</Text>
        <Text style={estilos.status}>
          {minutos === null ? 'desde o horário acima' : 'correndo desde o horário acima'}
        </Text>
      </View>
    </View>
  );
}

const ANEL = 216;

const estilos = StyleSheet.create({
  centro: { alignItems: 'center', marginBottom: 28 },
  anel: {
    width: ANEL,
    height: ANEL,
    borderRadius: ANEL / 2,
    borderWidth: 12,
    // O trilho do protótipo. A cor é dele, e é a única do arquivo que não vem
    // de `tokens` — ela não tem outro uso no app, e um token com um consumidor
    // só é nome sem economia.
    borderColor: '#EFE4F4',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tempo: {
    ...typography.display,
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -1,
    color: colors.headline,
  },
  status: { ...typography.itemRotulo, color: colors.neutro500, textAlign: 'center' },
});
