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

/** A ordem é a do grid da Home. `key` é também o parâmetro da rota /registro/[tipo]. */
export const CATEGORIAS: Categoria[] = [
  { key: 'amamentar', label: 'Amamentar', icon: 'heart', bg: colors.categoriaCoral },
  { key: 'fralda', label: 'Fralda', icon: 'water', bg: colors.categoriaAmarelo },
  { key: 'sono', label: 'Sono', icon: 'moon', bg: colors.categoriaLavanda },
  { key: 'mamadeira', label: 'Mamadeira', icon: 'flask', bg: colors.categoriaMenta },
  // Humor e Sintoma não têm cor de categoria própria no design system ainda. Em vez de
  // inventar hex novo, reaproveitam tokens existentes: rosa da marca e `warning`
  // (semântico de atenção, que é exatamente o papel do sintoma). Trocar quando o
  // documento de design definir as oficiais.
  { key: 'humor', label: 'Humor', icon: 'happy', bg: colors.rosa500 },
  { key: 'sintoma', label: 'Sintoma', icon: 'thermometer', bg: colors.warning },
];

export const CATEGORIA_POR_TIPO = Object.fromEntries(
  CATEGORIAS.map((c) => [c.key, c])
) as Record<TipoRegistro, Categoria>;
