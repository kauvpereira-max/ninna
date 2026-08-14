import { Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ICONES, type NomeDoIcone } from '../theme/icones';
import { ILUSTRACAO } from '../theme/ilustracoes';
import { CATEGORIA_POR_TIPO } from '../theme/categorias';
import type { TipoRegistro } from '../lib/registros';

/**
 * O ícone de um tipo de registro: a ilustração do protótipo, com a silhueta
 * atrás dela como rede.
 *
 * ------------------------------------------------------------------
 * A CASCATA, QUE É A DO PROTÓTIPO
 *
 * O `parts()` dele resolve em três camadas — PHOTO, depois ILL, depois D — e
 * nós tínhamos implementado só a última, achando que era a primeira. Agora:
 *
 *   1. `ILUSTRACAO[tipo]` — o PNG, quando existe
 *   2. o path do `icones.ts` na tinta da categoria — quando não existe
 *
 * A camada do meio (as 22 ilustrações SVG em viewBox 48) fica de fora: ela é o
 * fallback do PNG no protótipo, e ter PNG **e** SVG do mesmo desenho seria
 * carregar duas vezes o mesmo trabalho para um caso que não acontece.
 *
 * ⚠️ **A silhueta não é código morto — é a rede.** Tipo novo nasce sem PNG (o
 * Habilidade é o próximo), e sem este ramo ele renderizaria vazio. O `D` deixou
 * de ser o alvo e voltou a ser o que sempre foi no protótipo: a última camada.
 *
 * ------------------------------------------------------------------
 * SEM `tintColor`, E ISSO É DECISÃO
 *
 * As ilustrações são multicoloridas — o termômetro marca 36,5°C em vermelho
 * sobre branco, o prato tem quatro comidas. Pintá-las de uma cor só destruiria o
 * desenho. A cor da família continua onde sempre esteve: no círculo pastel
 * atrás, que quem chama já desenha.
 *
 * `resizeMode="contain"` é o `background-size: contain` do protótipo.
 *
 * ⚠️ O `photoPos: "50% 100%"` do protótipo NÃO foi traduzido, porque **ele não
 * faz nada lá.** Com `contain`, imagem quadrada em caixa quadrada preenche
 * exato e não sobra folga para posicionar. Medido: o `liz-full.png` é 512×512
 * com margem transparente zero nos quatro lados. Traduzir seria escrever um
 * mecanismo de alinhamento que nunca alinha.
 */
export function IconeDoTipo({ tipo, tamanho }: { tipo: TipoRegistro; tamanho: number }) {
  const ilustracao = ILUSTRACAO[tipo];
  if (ilustracao) {
    return (
      <Image
        source={ilustracao}
        // Decorativo: o rótulo vem do `accessibilityLabel` do tocável que
        // envolve o ícone, e anunciar as duas coisas leria o tipo duas vezes.
        accessible={false}
        accessibilityElementsHidden
        aria-hidden
        resizeMode="contain"
        style={{ width: tamanho, height: tamanho }}
      />
    );
  }
  const visual = CATEGORIA_POR_TIPO[tipo];
  return <Silhueta nome={visual.icon} tamanho={tamanho} cor={visual.tinta} />;
}

/**
 * A silhueta de uma cor, em viewBox 24 — o `D` do protótipo.
 *
 * Exportada porque tem um consumidor que **não é tipo de registro**: os cards de
 * Padrões, que rotulam MÉTRICA (horário, intervalo, duração). O `clock` da
 * duração nem existe como tipo, então não há PNG para ele e nunca vai haver.
 *
 * `fillRule="evenodd"` não é detalhe: o `donut` e o `face` dependem dele para
 * ter furo no meio em vez de mancha sólida.
 */
export function Silhueta({
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
