import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RegistroRecente } from '../lib/registros';
import { CATEGORIA_POR_TIPO } from '../theme/categorias';
import { colors, spacing, radius, typography, elevation } from '../theme/tokens';

/**
 * No Safari do iPhone, segurar o dedo sobre um elemento dispara o callout do
 * sistema e a seleção de texto antes de qualquer handler do app. Sem isso, o
 * long-press vira "copiar/compartilhar" do navegador em vez de atalho do app.
 *
 * Só existe na web: no nativo essas propriedades não são estilo válido de RN.
 */
export const semCalloutNaWeb =
  Platform.OS === 'web' ? ({ userSelect: 'none', WebkitTouchCallout: 'none' } as any) : null;

type Props = {
  registro: RegistroRecente;
  /** Texto da direita: hora na Rotina, momento relativo na Home. */
  horaLabel: string;
  /** Sobrescreve o resumo — a Home recalcula o sono em andamento num tick local. */
  resumo?: string;
  onPress: () => void;
  /** Só a Home passa: encerrar o sono aberto sem sair da tela. */
  acao?: React.ReactNode;
};

export function ItemRegistro({ registro, horaLabel, resumo, onPress, acao }: Props) {
  const visual = CATEGORIA_POR_TIPO[registro.tipo];
  const texto = resumo ?? registro.resumo;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir registro de ${visual.label}: ${texto}, ${horaLabel}`}
      style={[styles.item, semCalloutNaWeb]}
    >
      <View style={[styles.badge, { backgroundColor: visual.bg }]}>
        <Ionicons name={visual.icon} size={15} color={colors.onDark} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.resumo, registro.emAndamento && styles.ativo]}>{texto}</Text>
        <Text style={styles.categoria}>{visual.label}</Text>
      </View>

      {acao ?? <Text style={styles.hora}>{horaLabel}</Text>}
    </Pressable>
  );
}

// Estilo herdado da lista da Home, onde este item nasceu — inclusive a elevação e
// o peso SemiBold do resumo. A Rotina passa a usar o mesmo: duas listas de
// registro com aparências diferentes seria a mãe achando que são duas coisas.
const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutro0,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    // Dedo de mãe com bebê no colo, no meio da madrugada.
    minHeight: 44,
    ...elevation.level1,
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumo: { ...typography.body, color: colors.headline, fontFamily: 'NunitoSans_600SemiBold' },
  // Sono em andamento é timer ativo — um dos usos que o design system libera pro coral.
  ativo: { color: colors.coral600 },
  categoria: { ...typography.caption, color: colors.neutro400 },
  hora: { ...typography.caption, color: colors.neutro500 },
});
