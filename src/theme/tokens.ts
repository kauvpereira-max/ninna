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

  // Semânticas
  success: '#C9E4D5',
  successText: '#4F8863',
  warning: '#F4B183',
  warningText: '#A85A2E',

  // Paleta de categoria (badges de registro — fundo sólido, ícone branco)
  categoriaCoral: '#E15C42',   // Amamentar
  categoriaAmarelo: '#E8B03A', // Fralda
  categoriaLavanda: '#9B8AC4', // Sono
  categoriaMenta: '#6BAF92',   // Mamadeira

  // Modo noturno
  noiteBg: '#201915',
  noiteSurface: '#3A2E2A',
  noiteTexto: '#F7EDE4',
  noitePrimaria: '#D99A85',

  onDark: '#FFF3E9',
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
} as const;
