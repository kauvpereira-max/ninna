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
 *
 * ------------------------------------------------------------------
 * ⚠️ O TAMANHO VEM DO CÍRCULO, E AS DUAS CAMADAS NÃO USAM A MESMA FRAÇÃO
 *
 * O protótipo desenha, dentro do mesmo círculo pastel:
 *
 *     70px  ->  PNG 56px (80%)   silhueta 42px (60%)
 *     66px  ->  PNG 52px (79%)   silhueta 40px (61%)
 *
 * Não é inconsistência dele: a silhueta PREENCHE o próprio viewBox, e a
 * ilustração tem margem transparente por dentro. Igualar as duas frações
 * deixaria uma pequena e a outra estourando.
 *
 * Por isso quem chama passa o **círculo**, não o ícone. Passar o ícone foi o que
 * fez tudo sair a 43–54% do círculo na primeira versão: aqueles px estavam
 * calibrados para silhueta de uma cor, e a troca por ilustração não os reviu.
 * Ninguém nota porque silhueta pequena continua legível — ilustração pequena
 * vira um selo perdido no meio do pastel. Conferido no navegador em 14/08/2026.
 */
export function IconeDoTipo({ tipo, circulo }: { tipo: TipoRegistro; circulo: number }) {
  const ilustracao = ILUSTRACAO[tipo];
  const tamanho = Math.round(circulo * (ilustracao ? 0.8 : 0.6));
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
