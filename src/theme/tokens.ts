// Design System Ninna v1.6 — tokens
// Fonte da verdade: ninna-design-system-v1.md

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

  // Coral vívido — vigilância/ação (uso restrito: timers ativos, card de monitoramento, alertas)
  coral500: '#E15C42',
  coral600: '#C94A32',

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
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 16,
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
