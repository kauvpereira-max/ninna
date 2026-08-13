import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';
import { TIMELINE_X, TIMELINE_Y } from './ItemRegistro';

/**
 * A lista de registros com a linha vertical da timeline atrás dos ícones.
 *
 * ------------------------------------------------------------------
 * POR QUE A LINHA MORA AQUI E NÃO NO ITEM
 *
 * Ela precisa ser CONTÍNUA. Desenhada por item, ela quebraria em cada vão entre
 * dois itens, e o vão é onde a linha mais precisa existir — é ele que a faz
 * parecer uma linha do tempo em vez de um enfeite de cada linha.
 *
 * Como container, ela também sabe onde começar e terminar: no centro do
 * primeiro círculo e no do último, não nas bordas da lista. Linha que sobra
 * para fora do primeiro ícone parece erro de layout.
 *
 * ------------------------------------------------------------------
 * AS DUAS TELAS USAM ESTE MESMO CONTAINER
 *
 * Home e Rotina. É a mesma razão que fez o `ItemRegistro` existir: duas listas
 * de registro com aparências diferentes seria a mãe achando que são duas
 * coisas. A Rotina agrupa por dia, então cada dia ganha a sua linha — o que é o
 * desenho certo, porque a linha do tempo de terça não continua na de quarta.
 */
export function ListaDeRegistros({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.lista}>
      {/* `pointerEvents="none"`: a linha passa por baixo dos itens e não pode
          roubar o toque de nenhum deles. */}
      <View style={styles.linha} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { position: 'relative' },
  linha: {
    position: 'absolute',
    // `-1` para centrar os 2px de largura exatamente no eixo dos círculos. As
    // duas constantes vêm do `ItemRegistro`, que é quem define a geometria da
    // linha do item — importadas, e não copiadas, porque um número repetido nos
    // dois arquivos é a linha saindo do eixo na primeira vez que alguém mexer.
    left: TIMELINE_X - 1,
    top: TIMELINE_Y,
    bottom: TIMELINE_Y,
    width: 2,
    backgroundColor: colors.linha,
  },
});
