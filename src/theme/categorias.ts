// Identidade visual de cada tipo de registro: rótulo, ícone e cor do badge.
//
// Nasceu dentro de app/(tabs)/index.tsx e saiu de lá quando a tela de detalhe
// passou a precisar do mesmo badge. A Rotina do D6 é a terceira consumidora —
// três cópias do mesmo mapa é como um tipo de registro acaba com cor diferente
// em cada tela.

import { Ionicons } from '@expo/vector-icons';
import type { TipoRegistro } from '../lib/registros';
import { colors } from './tokens';

export type Categoria = {
  key: TipoRegistro;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
};

/**
 * Tipo → identidade visual, e é aqui que a exaustividade é COBRADA.
 *
 * Antes isto era derivado de uma lista com
 * `Object.fromEntries(...) as Record<TipoRegistro, Categoria>`, e o `as` é um
 * cast: ele AFIRMA a exaustividade em vez de exigi-la. Somar um tipo ao
 * `TipoRegistro` sem somar a entrada aqui **compilava**, e quebrava na tela de
 * detalhe — `visual.label` sobre `undefined`, tela vermelha, no caminho em que a
 * mãe abre um registro.
 *
 * É exatamente o modo de falha que o bloco 2 existiu para matar: "faltar uma não
 * quebrava o build, quebrava a tela, mais tarde, para a mãe". Com 14 tipos
 * entrando, ele seria exercitado 14 vezes.
 *
 * Declarado como literal, o TypeScript passa a exigir a chave: tipo novo sem cor
 * e sem ícone não compila, e o erro aparece no editor de quem está somando o
 * tipo — não na tela de quem está com o bebê no colo.
 *
 * A ORDEM não mora aqui. `Record` não tem ordem que se possa confiar, e as duas
 * listas abaixo dizem qual é a delas.
 */
export const CATEGORIA_POR_TIPO: Record<TipoRegistro, Categoria> = {
  amamentar: { key: 'amamentar', label: 'Amamentar', icon: 'heart', bg: colors.categoriaCoral },
  fralda: { key: 'fralda', label: 'Fralda', icon: 'water', bg: colors.categoriaAmarelo },
  sono: { key: 'sono', label: 'Sono', icon: 'moon', bg: colors.categoriaLavanda },
  mamadeira: { key: 'mamadeira', label: 'Mamadeira', icon: 'flask', bg: colors.categoriaMenta },
  // Humor e Sintoma não têm cor de categoria própria no design system ainda. Em
  // vez de inventar hex novo, reaproveitam tokens existentes: rosa da marca e
  // `warning` (semântico de atenção, que é exatamente o papel do sintoma).
  // Trocar quando o documento de design definir as oficiais.
  humor: { key: 'humor', label: 'Humor', icon: 'happy', bg: colors.rosa500 },
  sintoma: { key: 'sintoma', label: 'Sintoma', icon: 'thermometer', bg: colors.warning },
};

/**
 * A ordem canônica de TODOS os tipos — é a fila de chips da Rotina.
 *
 * Separada dos atalhos da Home de propósito, e a separação é do bloco 3: com 20
 * tipos, "todos os tipos" e "o que cabe na Home" deixam de ser a mesma lista.
 * Filtrar precisa alcançar tudo; registrar precisa ser rápido.
 */
export const TODOS_OS_TIPOS: TipoRegistro[] = [
  'amamentar',
  'fralda',
  'sono',
  'mamadeira',
  'humor',
  'sintoma',
];

/**
 * O QUE APARECE NA HOME, e é uma lista FIXA.
 *
 * Decidido em 11/08/2026, com os 14 tipos à frente. A alternativa era adaptativa
 * — os mais usados daquele bebê, e o dado para isso já existe —, e ela perde por
 * uma razão que não é técnica:
 *
 * > mãe cansada precisa que o botão esteja onde estava ontem.
 *
 * Um grid que se reordena sozinho obriga a reler a tela toda vez, às 3h da
 * manhã, com o bebê no colo. O que se ganha em toques se perde em atenção.
 *
 * Revisitar quando houver dado de uso real. Até lá, os tipos que ficarem de fora
 * entram por uma tela "Mais tipos" — que só passa a existir quando houver tipo
 * de fora, para não nascer vazia.
 */
export const ATALHOS_DA_HOME: TipoRegistro[] = [
  'amamentar',
  'fralda',
  'sono',
  'mamadeira',
  'humor',
  'sintoma',
];

/** Todas as categorias, na ordem canônica. É o que a Rotina usa nos filtros. */
export const CATEGORIAS: Categoria[] = TODOS_OS_TIPOS.map((t) => CATEGORIA_POR_TIPO[t]);

/** As da Home, na ordem do grid. `key` é o parâmetro da rota /registro/[tipo]. */
export const CATEGORIAS_DA_HOME: Categoria[] = ATALHOS_DA_HOME.map((t) => CATEGORIA_POR_TIPO[t]);
