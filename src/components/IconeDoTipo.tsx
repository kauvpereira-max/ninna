import Svg, { Path } from 'react-native-svg';
import { ICONES, type NomeDoIcone } from '../theme/icones';

/**
 * O ícone de um tipo de registro, desenhado com o path do protótipo.
 *
 * Uma peça só para as seis superfícies que mostram tipo: o grid da Home, o item
 * da timeline, a tela de detalhe, "Mais tipos", os cards de Padrões e o card de
 * dica do modal. Seis `<Ionicons name>` viraram seis `<IconeDoTipo>`.
 *
 * `fillRule="evenodd"` não é detalhe: os desenhos do protótipo são silhuetas com
 * furo — o `donut` do perímetro cefálico e o `face` do humor dependem dele para
 * ter buraco no meio em vez de mancha sólida.
 */
export function IconeDoTipo({
  nome,
  tamanho,
  cor,
}: {
  nome: NomeDoIcone;
  tamanho: number;
  cor: string;
}) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      <Path d={ICONES[nome]} fill={cor} fillRule="evenodd" />
    </Svg>
  );
}
