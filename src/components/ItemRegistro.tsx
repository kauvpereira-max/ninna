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
        <Ionicons name={visual.icon} size={15} color={visual.tinta} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.resumo, registro.emAndamento && styles.ativo]}>{texto}</Text>
        <Text style={styles.categoria}>{visual.label}</Text>
      </View>

      {acao ?? <Text style={styles.hora}>{horaLabel}</Text>}
    </Pressable>
  );
}

// Estilo herdado da lista da Home, onde este item nasceu — inclusive a elevação.
// A Rotina usa o mesmo: duas listas de registro com aparências diferentes seria a
// mãe achando que são duas coisas.
//
// O resumo era `body` (14) em SemiBold; o protótipo pede 16 em Bold, e o rótulo
// sai de 12/Regular para 12,5/SemiBold. É a diferença que mais muda a leitura da
// lista, e ela é de PESO, não de layout.
const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutro0,
    borderRadius: radius.card,
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
  resumo: { ...typography.itemDetalhe, color: colors.headline },
  /**
   * Sono em andamento. Hoje é só a COR DO TEXTO do resumo — `coral600`
   * (`#C94A32`) —, não fundo sólido nem ícone branco.
   *
   * ⚠️ NÃO LEIA ISTO COMO DECISÃO DE VIGILÂNCIA. É coral porque, quando foi
   * escrito, coral era o único recurso disponível para dizer "está correndo": os
   * pares pastéis não existiam ainda, e a paleta de categoria era sólida e
   * vívida. Não é a superfície escura do card de monitoramento, e não herda a
   * regra dele.
   *
   * A ALTERNATIVA, para quem for mexer nisto:
   *
   * O par `pastel.roxo` é exatamente o material para este caso — o sono já veste
   * essa família no badge. Em andamento poderia ser o item inteiro com fundo
   * `#ECE7F8` e texto na tinta `#7A67A8`, em vez de trocar a cor do texto por
   * coral. Fica dentro do sistema, usa a cor do próprio tipo, e não pede que o
   * coral signifique duas coisas.
   *
   * Não foi feito porque não é o bloco disto, e trocar o realce do sono no meio
   * dos blocos de fidelidade misturaria fidelidade com desenho novo — o
   * protótipo não desenha o sono em andamento na lista.
   */
  ativo: { color: colors.coral600 },
  categoria: { ...typography.itemRotulo, color: colors.textoTerciario },
  hora: { ...typography.caption, color: colors.neutro500 },
});
