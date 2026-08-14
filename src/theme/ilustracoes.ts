import type { ImageSourcePropType } from 'react-native';
import type { TipoRegistro } from '../lib/registros';

/**
 * As ilustrações dos tipos de registro — a camada de cima do protótipo.
 *
 * ------------------------------------------------------------------
 * O PROTÓTIPO TEM QUATRO CAMADAS, E ESTA É A PRIMEIRA
 *
 * A função `parts()` dele resolve o ícone em cascata:
 *
 *   PHOTO  → PNG embutido, por LABEL (`PHOTO_ID`)          ← esta tabela
 *   ILL    → ilustração SVG multicolor em viewBox 48
 *   D      → silhueta de uma cor em viewBox 24             ← o fallback
 *
 * Nós tínhamos implementado a terceira achando que era a primeira. O mapeamento
 * abaixo é o `PHOTO_ID` literal, e os nomes de arquivo são o `PHOTO_SRC`.
 *
 * `amamentar` é a única que foge do padrão `ic-*`: aponta para `liz`, a
 * ilustração inteira. Não é falta de desenho — **o gesto de amamentar não tem
 * objeto**, e o app já é sobre um bebê específico.
 *
 * ------------------------------------------------------------------
 * ⚠️ `require` ESTÁTICO, E NÃO É PREFERÊNCIA
 *
 * O Metro resolve `require` em tempo de empacotamento:
 * `require('../../assets/icones/' + nome + '.png')` não compila, nem para web
 * nem para nativo. A tabela literal é a forma de dizer isso.
 *
 * E na web ela **já é sob demanda**: cada `require` vira uma URL com hash, e o
 * navegador só busca quando um `<Image>` daquele tipo realmente pinta. O bundle
 * cresceu 3.569 bytes com os 19 — medido, não estimado.
 *
 * ------------------------------------------------------------------
 * É PARCIAL DE PROPÓSITO
 *
 * `Partial` porque a ausência é um estado previsto: tipo novo sem PNG cai na
 * silhueta do `D` e desenha alguma coisa, em vez de quebrar. Quem faz essa
 * escolha é o `IconeDoTipo`.
 *
 * `ic-chart.png` está no disco e **fora** desta tabela: ele é do Habilidade, que
 * ainda não é tipo (PRODUTO.md §3.4). Requerer agora emitiria 37 KB para
 * ninguém — o `require` entra junto com o tipo.
 */
export const ILUSTRACAO: Partial<Record<TipoRegistro, ImageSourcePropType>> = {
  amamentar: require('../../assets/icones/liz-full.png'),
  mamadeira: require('../../assets/icones/ic-bottle.png'),
  fralda: require('../../assets/icones/ic-diaper.png'),
  sono: require('../../assets/icones/ic-moon.png'),
  banho: require('../../assets/icones/ic-soap.png'),
  comida: require('../../assets/icones/ic-plate.png'),
  hidratacao: require('../../assets/icones/ic-cup.png'),
  extracao: require('../../assets/icones/ic-pump.png'),
  medicacao: require('../../assets/icones/ic-pill.png'),
  vitamina: require('../../assets/icones/ic-vitamin.png'),
  sintoma: require('../../assets/icones/ic-thermo.png'),
  humor: require('../../assets/icones/ic-mood.png'),
  peso: require('../../assets/icones/ic-scale.png'),
  altura: require('../../assets/icones/ic-ruler.png'),
  // ⚠️ `circunferencia` NÃO ENTRA, e a ausência é decisão — ver o bloco no fim
  // deste arquivo. O `ic-head.png` fica no disco e não é requerido.
  atividade: require('../../assets/icones/ic-blocks.png'),
  passeio: require('../../assets/icones/ic-stroller.png'),
  leitura: require('../../assets/icones/ic-book.png'),
  vacina: require('../../assets/icones/ic-syringe.png'),
};

/**
 * ⚠️ POR QUE O PERÍMETRO CEFÁLICO NÃO TEM ILUSTRAÇÃO
 *
 * O `ic-head.png` do protótipo é **a mesma menina do `liz-full.png`**: cabelo
 * castanho cacheado, adereço rosa na cabeça, corpo claro. A 30px na Home e a
 * 20px na timeline, Amamentar e Perímetro cefálico viram o mesmo ícone — e as
 * duas coexistem na timeline, que é onde a mãe procura um registro rolando a
 * lista sem ler rótulo.
 *
 * Amamentar fica com a figura da criança porque é o único tipo **sem objeto**:
 * não há mamadeira, fralda nem termômetro para desenhar, e o app já é sobre um
 * bebê específico. Quem sai é o outro.
 *
 * No lugar entra a silhueta `donut` do `D` — um anel de medida, que não colide
 * com nada no conjunto e não precisa de arte nova. O `IconeDoTipo` já faz isso
 * sozinho: sem entrada aqui, ele cai na silhueta.
 *
 * **Isto não é pendência.** O `scripts/teste-ilustracoes.ts` declara a ausência
 * em `SEM_ILUSTRACAO` e reprova quem devolver o `circunferencia` para a tabela
 * acima — porque "consertar o que faltou" é exatamente o que alguém faria daqui
 * a três meses, e traria a colisão de volta.
 *
 * O `ic-head.png` continua no disco, sem `require`: não é emitido no build, e
 * fica lá para o dia em que a decisão for outra.
 */
