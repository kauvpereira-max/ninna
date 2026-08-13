// Design System Ninna v1.6 — tokens
//
// ⚠️ FONTE DA VERDADE: `docs/design-do-prototipo.md`.
//
// Este cabeçalho apontava para `ninna-design-system-v1.md`, que NÃO existe no
// repositório — apontava para lugar nenhum desde sempre. A referência real é o
// protótipo do Claude Design, extraído em 13/08/2026.
//
// E a precedência é essa mesma: **onde o protótipo divergir destes tokens ou do
// `CLAUDE.md`, o protótipo vence.** A divergência é anotada, não resolvida em
// silêncio — e só para quem escreve o código, nunca em silêncio para quem lê.

export const colors = {
  // Rosa — marca
  rosa50: '#FEF6F5',
  rosa100: '#FCE9E7',
  rosa200: '#F8D5D1',
  rosa300: '#F3C9C5',
  rosa500: '#E08A80',
  rosa700: '#A85A4E',

  // Amarelo — secundária
  amarelo50: '#FFFCF2',
  amarelo100: '#FDF3D9',
  amarelo200: '#FBE8B8',
  amarelo400: '#F2C55C',
  amarelo500: '#E8B03A',

  // Neutros
  neutro0: '#FFFFFF',
  neutro50: '#FFF9F2',
  neutro100: '#F5EAE1',
  neutro200: '#E3D3C7',
  neutro300: '#C4AA9A',
  neutro400: '#9C7C6C',
  neutro500: '#7A5C4E',
  neutro600: '#5C4A42',
  neutro700: '#453832',
  neutro800: '#2E2622',
  neutro900: '#201915',

  // Texto de headline (mais contraste que neutro600)
  headline: '#2B211D',

  /**
   * Texto terciário — o rótulo abaixo do detalhe no item de registro.
   *
   * Não é o `neutro300` (`#C4AA9A`), e a diferença é de papel, não de tom: o
   * `neutro300` é chevron, ícone de estado vazio e placeholder. Este é texto
   * que se lê. Sobrescrever um com o outro juntaria dois papéis que o protótipo
   * separa.
   */
  textoTerciario: '#B8A69C',

  // ------------------------------------------------------------------
  // OS DOIS CORAIS, E ELES NÃO SÃO O MESMO
  //
  // `coral500` é o de VIGILÂNCIA: timer correndo, card de monitoramento, alerta.
  // Ele significa "está acontecendo agora" — e é por isso que não entra em
  // decoração.
  //
  // `coralAcao` é do protótipo, e é outro hex. Ele marca AÇÃO: o "+" do grid de
  // atalhos, os links "Ver tudo" e "Relatórios". Não é vigilância vazando para
  // enfeite — é escolha do designer, e o protótipo é a autoridade.
  //
  // A regra do CLAUDE.md é sobre o `#E15C42`, não sobre a família coral.
  // ------------------------------------------------------------------
  coral500: '#E15C42',
  coral600: '#C94A32',
  coralAcao: '#F4796B',

  // ------------------------------------------------------------------
  // Superfícies e linhas — extraídas do protótipo
  //
  // O protótipo usa DOIS fundos, e a distinção é de tela, não de gosto:
  // `superficie` nas abas e nos modais, `neutro50` (#FFF9F2) em onboarding e
  // confirmação. Pintar tudo com um só apaga a diferença de propósito.
  // ------------------------------------------------------------------
  superficie: '#FFFDFA',
  superficieNota: '#F9F4EF',   // card de nota do dia
  superficieBotao: '#F4EBE3',  // botão de fechar do modal
  superficieFaixa: '#FDF2EC',  // faixa de total dentro do modal

  // A família de linha que não existia. `linha` é a mais usada: divisória,
  // borda de card branco e — no bloco da timeline — a linha vertical.
  linha: '#F3EDE6',
  linhaModal: '#F3E2D8',
  linhaPill: '#F1EBE4',
  linhaTabBar: '#F2E3DA',

  /**
   * Botão desabilitado — rosa dessaturado, não cinza.
   *
   * O tokens não tinha estado desabilitado: o `Button` resolvia com
   * `opacity: 0.5`, que apaga o botão inteiro, sombra junto. O protótipo pinta
   * o estado em vez de esmaecê-lo, e o resultado continua sendo da marca.
   */
  desabilitadoFundo: '#F3D9D3',
  desabilitadoTexto: '#C6A79F',

  // Semânticas
  success: '#C9E4D5',
  successText: '#4F8863',
  warning: '#F4B183',
  warningText: '#A85A2E',

  // Modo noturno
  noiteBg: '#201915',
  noiteSurface: '#3A2E2A',
  noiteTexto: '#F7EDE4',
  noitePrimaria: '#D99A85',

  onDark: '#FFF3E9',
} as const;

/**
 * As dez famílias pastéis do protótipo — a identidade de cada tipo de registro.
 *
 * ------------------------------------------------------------------
 * ELAS SUBSTITUÍRAM A PALETA DE CATEGORIA, E ISSO CONSERTOU UMA REGRA
 *
 * A antiga (`categoriaCoral`, `categoriaAmarelo`, `categoriaLavanda`,
 * `categoriaMenta`) era sólida e vívida, para ícone branco — e cobria **4 dos
 * 20 tipos**. Os outros dezesseis vinham emprestando `rosa500`, `warning` e
 * `neutro500` por falta de cor própria.
 *
 * E o `categoriaCoral` era, literalmente, `#E15C42` — o mesmo hex do
 * `coral500`, a cor de vigilância. Ou seja: o badge de Amamentar usava a cor
 * que o `CLAUDE.md` reserva para o card de monitoramento, e ninguém tinha
 * notado. Trocar pelos pastéis não abre exceção nenhuma: fecha uma que já
 * estava aberta.
 *
 * ------------------------------------------------------------------
 * SÃO PARES, E É POR ISSO QUE NÃO MORAM EM `colors`
 *
 * `fundo` é o círculo; `tinta` é o ícone e o texto sobre ele. Os dois só fazem
 * sentido juntos — separados em dez chaves planas, a próxima pessoa combinaria
 * o fundo de um com a tinta de outro sem que nada reclamasse.
 *
 * ⚠️ A tinta é escura de propósito: no sistema antigo o ícone era branco sobre
 * cor forte. Fundo pastel com ícone branco é ilegível — se algum consumidor
 * ficou com `colors.onDark`, ele some.
 */
export const pastel = {
  coral: { fundo: '#FDE7E1', tinta: '#D9502F' },
  amarelo: { fundo: '#FCF2D6', tinta: '#C08A1E' },
  roxo: { fundo: '#ECE7F8', tinta: '#7A67A8' },
  verde: { fundo: '#DDF0E7', tinta: '#3F8368' },
  azul: { fundo: '#E2EEF7', tinta: '#43799A' },
  rosa: { fundo: '#FBE7E4', tinta: '#B96C63' },
  terra: { fundo: '#F8E7D9', tinta: '#A55E30' },
  lavanda: { fundo: '#ECE9F9', tinta: '#7A6DB8' },
  salvia: { fundo: '#E3F0E6', tinta: '#5A8768' },
  ameixa: { fundo: '#F7E6EF', tinta: '#8B4E6E' },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  /**
   * O respiro lateral de toda tela, e o valor mais usado do protótipo.
   *
   * Fica fora da escala de 8 de propósito: a escala saltava 16 → 24, e nenhum
   * dos dois é o que o protótipo desenha. Nome semântico em vez de `lg2` porque
   * ele tem UM uso, e um nome que diz qual evita que vire "o 20 genérico".
   */
  respiro: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 16,
  /** Mini-cards de estatística. O menor raio de card do protótipo. */
  mini: 12,
  /** Cards de conteúdo — o raio mais comum do protótipo. Entre `md` e `lg`. */
  card: 20,
  lg: 24,
  full: 999,
} as const;

// Fontes: Fredoka (títulos) e Nunito Sans (corpo) — carregadas via expo-font, ver src/theme/fonts.ts
export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontFamily: 'Fredoka_600SemiBold' },
  h1: { fontSize: 26, lineHeight: 32, fontFamily: 'Fredoka_600SemiBold' },
  h2: { fontSize: 22, lineHeight: 28, fontFamily: 'Fredoka_600SemiBold' },
  h3: { fontSize: 18, lineHeight: 24, fontFamily: 'Fredoka_500Medium' },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontFamily: 'NunitoSans_400Regular' },
  body: { fontSize: 14, lineHeight: 20, fontFamily: 'NunitoSans_400Regular' },
  label: { fontSize: 13, lineHeight: 18, fontFamily: 'NunitoSans_600SemiBold', letterSpacing: 0.2 },
  // O design pede Medium (500) aqui, mas NunitoSans-Medium.ttf não está em assets/fonts/,
  // então a família não resolvia e caía no fallback do sistema. Regular é o mais próximo
  // disponível — trocar de volta pra Medium quando o arquivo da fonte entrar no projeto.
  caption: { fontSize: 12, lineHeight: 16, fontFamily: 'NunitoSans_400Regular' },

  // ------------------------------------------------------------------
  // Entradas do protótipo — nomeadas pelo elemento, não pela escala
  //
  // A escala acima é nomeada por TAMANHO, e cada entrada fixa uma família — ou
  // seja, o peso vem carona no nome. O protótipo usa o mesmo tamanho em pesos
  // diferentes (18px em 500 e em 600; 16px em 700 onde o `bodyLarge` tem 400),
  // e isso não cabe numa escala de tamanho.
  //
  // Enquanto forem poucas, entram nomeadas pelo elemento — como o `radius.card`.
  // Se virarem muitas, aí a tipografia passa a ser `{ tamanho, peso }`, e isso é
  // refatoração, não item de bloco.
  // ------------------------------------------------------------------

  /** Item da lista, o detalhe: 16/700 no protótipo, contra o 16/400 do `bodyLarge`. */
  itemDetalhe: { fontSize: 16, lineHeight: 24, fontFamily: 'NunitoSans_700Bold' },

  /** O rótulo abaixo dele. O 12,5 é literal do protótipo, não arredondamento. */
  itemRotulo: { fontSize: 12.5, lineHeight: 18, fontFamily: 'NunitoSans_600SemiBold' },

  /** O texto do CTA: 16,5 em Bold. O `label` com `fontSize` sobrescrito dava 15/600. */
  cta: { fontSize: 16.5, lineHeight: 22, fontFamily: 'NunitoSans_700Bold' },

  /** O número dos mini-stats: Fredoka 21, a ponta de baixo da faixa 21–24 do protótipo. */
  numeroStat: { fontSize: 21, lineHeight: 26, fontFamily: 'Fredoka_600SemiBold' },

  /**
   * A saudação da Home: Fredoka 25 em SemiBold.
   *
   * 25 e não o `h1` (26): o protótipo é literal, e o `letterSpacing` negativo faz
   * parte — títulos grandes dele fecham em `-.2px`, e sem isso o texto fica com
   * ar de largo no mesmo corpo.
   */
  saudacao: { fontSize: 25, lineHeight: 32, fontFamily: 'Fredoka_600SemiBold', letterSpacing: -0.2 },

  /**
   * O subtítulo dela — e AQUI MORA A DÍVIDA DA FONTE.
   *
   * O protótipo pede **14,5 em Medium (500)**, e `NunitoSans-Medium.ttf` não
   * está em `assets/fonts/`: só Regular, SemiBold e Bold. Família que não existe
   * cai no fallback do sistema **sem erro nenhum**, que é como o
   * `typography.caption` passou meses errado.
   *
   * Fica em **Regular (400)** — o mesmo desvio que o `caption` já tomou, para
   * não haver dois paliativos diferentes para a mesma falta. O 600 seria pesado
   * demais para texto de apoio.
   *
   * Quando o `.ttf` entrar, os DOIS voltam juntos.
   */
  saudacaoSub: { fontSize: 14.5, lineHeight: 21, fontFamily: 'NunitoSans_400Regular' },
} as const;

// Elevação — sombra sempre suave, nunca pesada/3D (princípio do design system)
export const elevation = {
  level1: {
    shadowColor: colors.neutro600,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1, // Android
  },
  level2: {
    shadowColor: colors.neutro600,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  level3: {
    shadowColor: colors.neutro600,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },

  // ------------------------------------------------------------------
  // A SOMBRA DO CTA TEM A COR DO BOTÃO, NÃO CINZA
  //
  // É o que o protótipo chama de brilho, e é a única sombra colorida do
  // sistema. Os três níveis acima usam `neutro600` fixo, e nenhum deles
  // consegue expressar isto.
  //
  // Os números são os do protótipo direto, sem conversão: `0 8px 20px` vira
  // offset 8 e radius 20. É a convenção que já estava aqui — o `level1` é
  // `0 1px 3px` e tem `shadowRadius: 3`, batendo com o protótipo dígito a
  // dígito. Converter só um quebraria a régua dos outros.
  //
  // ⚠️ No Android, `elevation` não carrega cor: a sombra sai cinza de qualquer
  // jeito. O brilho é da web e do iOS — e a web é onde a Ninna mora hoje.
  // ------------------------------------------------------------------

  /** CTA em repouso — `rgb(224,138,128)` é o `rosa500`. */
  ctaRosa: {
    shadowColor: colors.rosa500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },

  /** O "+" do grid de atalhos — mesma ideia, com o coral de AÇÃO. */
  acaoCoral: {
    shadowColor: colors.coralAcao,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },

  /** CTA com o cronômetro correndo — `rgb(225,92,66)` é o `coral500`, e aqui ele é vigilância. */
  ctaCoral: {
    shadowColor: colors.coral500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 8,
  },
} as const;
