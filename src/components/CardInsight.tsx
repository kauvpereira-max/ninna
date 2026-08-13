import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme/tokens';

type Props = {
  nomeBebe: string;
  texto: string;
  /** Frase de aprendizado em vez de padrão — muda o ícone, nunca o tom. */
  aprendendo: boolean;
};

/**
 * O card "A ROTINA DE {NOME}" da Home, agora com insight de verdade.
 *
 * Mantém a paleta de vigilância (superfície escura + coral) porque É o card de
 * monitoramento — não é uso novo dela. A regra do CLAUDE.md proíbe levar essa
 * paleta pra botão comum e onboarding, e isso continua valendo.
 *
 * Sem artigo antes do nome no rótulo: `sex` é opcional no cadastro, e "DE A LIZ"
 * não existe.
 *
 * O card não tem número solto, rótulo de métrica, unidade nem barra de
 * progresso. É uma frase. Tudo que parecesse painel empurraria a mãe a comparar
 * o bebê com uma referência que a Ninna não tem e não quer ter.
 */
export function CardInsight({ nomeBebe, texto, aprendendo }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={aprendendo ? 'eye-outline' : 'moon'} size={18} color={colors.coral500} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>A ROTINA DE {nomeBebe.toUpperCase()}</Text>
        <Text style={styles.texto}>{texto}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.neutro800,
    // 24 e não 20: no protótipo o card de monitoramento tem raio próprio, maior
    // que o dos cards de conteúdo. Ele é o único elemento com essa medida.
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.noiteSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.caption,
    color: colors.coral500,
    fontFamily: 'NunitoSans_700Bold',
    marginBottom: 2,
  },
  texto: {
    ...typography.body,
    color: colors.onDark,
    fontFamily: 'NunitoSans_600SemiBold',
  },
});
