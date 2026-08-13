// Identidade visual de cada tipo de registro: rótulo, ícone e cor do badge.
//
// Nasceu dentro de app/(tabs)/index.tsx e saiu de lá quando a tela de detalhe
// passou a precisar do mesmo badge. A Rotina do D6 é a terceira consumidora —
// três cópias do mesmo mapa é como um tipo de registro acaba com cor diferente
// em cada tela.

// `import type`, e não import comum: `Ionicons` só aparece em posição de tipo
// (`keyof typeof Ionicons.glyphMap`). Como valor, ele arrastaria o
// `@expo/vector-icons` inteiro — que não resolve no Node — para dentro de
// qualquer teste que importe este módulo.
import type { Ionicons } from '@expo/vector-icons';
import type { TipoRegistro } from '../lib/registros';
import { pastel } from './tokens.ts';

export type Categoria = {
  key: TipoRegistro;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** O círculo. Pastel. */
  bg: string;
  /** O ícone sobre ele. Escuro — fundo pastel com ícone branco some. */
  tinta: string;
};

/** Açúcar para as 19 entradas abaixo não repetirem `pastel.x.fundo` duas vezes. */
const de = (f: (typeof pastel)[keyof typeof pastel]) => ({ bg: f.fundo, tinta: f.tinta });

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
 *
 * ------------------------------------------------------------------
 * AS FAMÍLIAS SE REPETEM, E ISSO É DESENHO — NÃO FALTA DE COR
 *
 * O mapeamento é o do protótipo, literal. Verde cobre Mamadeira, Extração e
 * Passeio; azul cobre Banho, Hidratação e Vacina. Com 20 tipos, cor deixa de ser
 * identidade única e vira **agrupamento semântico** — dez famílias para vinte
 * tipos é a proporção que o designer escolheu.
 *
 * Antes daqui, dezesseis dos dezenove emprestavam `rosa500`, `warning` ou
 * `neutro500` "até o documento de design definir as oficiais". Ele definiu.
 */
export const CATEGORIA_POR_TIPO: Record<TipoRegistro, Categoria> = {
  amamentar: { key: 'amamentar', label: 'Amamentar', icon: 'heart', ...de(pastel.coral) },
  fralda: { key: 'fralda', label: 'Fralda', icon: 'water', ...de(pastel.amarelo) },
  sono: { key: 'sono', label: 'Sono', icon: 'moon', ...de(pastel.roxo) },
  mamadeira: { key: 'mamadeira', label: 'Mamadeira', icon: 'flask', ...de(pastel.verde) },
  humor: { key: 'humor', label: 'Humor', icon: 'happy', ...de(pastel.rosa) },
  sintoma: { key: 'sintoma', label: 'Sintoma', icon: 'thermometer', ...de(pastel.coral) },
  banho: { key: 'banho', label: 'Banho', icon: 'sparkles', ...de(pastel.azul) },
  passeio: { key: 'passeio', label: 'Passeio', icon: 'walk', ...de(pastel.verde) },
  leitura: { key: 'leitura', label: 'Leitura', icon: 'book', ...de(pastel.lavanda) },
  atividade: { key: 'atividade', label: 'Atividade', icon: 'color-palette', ...de(pastel.terra) },
  comida: { key: 'comida', label: 'Comida', icon: 'restaurant', ...de(pastel.terra) },
  hidratacao: { key: 'hidratacao', label: 'Hidratação', icon: 'water-outline', ...de(pastel.azul) },
  extracao: { key: 'extracao', label: 'Extração', icon: 'medical', ...de(pastel.verde) },
  peso: { key: 'peso', label: 'Peso', icon: 'scale', ...de(pastel.ameixa) },
  altura: { key: 'altura', label: 'Altura', icon: 'resize', ...de(pastel.salvia) },
  circunferencia: { key: 'circunferencia', label: 'Perímetro cefálico', icon: 'ellipse-outline', ...de(pastel.lavanda) },
  medicacao: { key: 'medicacao', label: 'Medicação', icon: 'medkit', ...de(pastel.rosa) },
  vitamina: { key: 'vitamina', label: 'Vitamina', icon: 'nutrition', ...de(pastel.amarelo) },
  vacina: { key: 'vacina', label: 'Vacina', icon: 'shield-checkmark', ...de(pastel.azul) },
  // Habilidade tem família no protótipo (ameixa) e ainda não é tipo do app —
  // `PRODUTO.md` §3.4. Quando entrar, a cor já está decidida.
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
  'banho',
  'passeio',
  'leitura',
  'atividade',
  'comida',
  'hidratacao',
  'extracao',
  'peso',
  'altura',
  'circunferencia',
  'medicacao',
  'vitamina',
  'vacina',
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
  // Banho sobe, e Passeio, Leitura e Atividade não. O critério não é
  // frequência de uso — é QUANDO ela registra: banho é rotina diária e se anota
  // na hora, como fralda. Os outros três são esporádicos e quase sempre
  // lembrados depois, e para "depois" a tela de Mais tipos serve igual.
  'banho',
];

/**
 * ⚠️ OITO É O TETO, e ele é decisão de produto tomada em 12/08/2026.
 *
 * O grid da Home vale por ser lido de relance, com uma mão, no escuro. Passando
 * de oito ele deixa de ser um conjunto que se reconhece pela forma e vira uma
 * lista que se lê — e aí o atalho custa mais atenção do que economiza.
 *
 * Alimentação e Crescimento trazem seis tipos. Se algum deles for candidato a
 * subir, a pergunta não é "cabe mais um?" — é qual sai.
 */
export const TETO_DE_ATALHOS = 8;

/** Todas as categorias, na ordem canônica. É o que a Rotina usa nos filtros. */
export const CATEGORIAS: Categoria[] = TODOS_OS_TIPOS.map((t) => CATEGORIA_POR_TIPO[t]);

/** As da Home, na ordem do grid. `key` é o parâmetro da rota /registro/[tipo]. */
export const CATEGORIAS_DA_HOME: Categoria[] = ATALHOS_DA_HOME.map((t) => CATEGORIA_POR_TIPO[t]);

/**
 * O que sobra — a tela "Mais tipos", e o botão que leva até ela.
 *
 * Derivada, e não escrita: um tipo que entre nos atalhos sai daqui sozinho, e o
 * dia em que todos estiverem lá esta lista fica vazia. A Home lê o `length` para
 * decidir se mostra o botão, então a tela e o caminho até ela se apagam juntos,
 * sem ninguém precisar lembrar de nenhum dos dois.
 */
export const CATEGORIAS_FORA_DA_HOME: Categoria[] = TODOS_OS_TIPOS.filter(
  (t) => !ATALHOS_DA_HOME.includes(t)
).map((t) => CATEGORIA_POR_TIPO[t]);
