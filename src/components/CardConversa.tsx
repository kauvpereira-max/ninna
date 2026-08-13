import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme/tokens';

type Props = {
  nomeBebe: string;
  onPress: () => void;
};

/**
 * A porta de entrada da aba Ninna, na Home.
 *
 * ------------------------------------------------------------------
 * A COPY REPETE A PROMESSA DA ABA, DE PROPÓSITO
 *
 * O subtítulo é o mesmo que a tela vazia da aba Ninna já faz: perguntar sobre
 * horários, quantidades e o que vem se repetindo. Não é falta de imaginação —
 * é a tese.
 *
 * Um card de entrada que prometesse mais do que a aba entrega ("tire suas
 * dúvidas sobre o bebê") faria a mãe chegar lá com a pergunta errada e receber
 * a recusa de fora de escopo. A porta tem que ter o tamanho da sala.
 *
 * Sem artigo antes do nome: `sex` é opcional no cadastro.
 *
 * ------------------------------------------------------------------
 * O ÍCONE É O MESMO DA ABA
 *
 * `chatbubble-ellipses`, igual ao da tab bar. A mãe precisa reconhecer que este
 * card leva ÀQUELE lugar — ícone diferente para o mesmo destino é uma pista
 * falsa numa tela que ela lê de relance.
 *
 * O protótipo anima este ícone (`nnBreathe`, 4,6–5,2s). Estático por enquanto:
 * animação é acabamento, e o próprio documento diz que não é requisito.
 */
export function CardConversa({ nomeBebe, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Conversar com a Ninna sobre os registros de ${nomeBebe}`}
    >
      {/* O gradiente é do protótipo: branco no topo, `superficieRosada`
          embaixo. É o mesmo `#FDF4F1` do card de monitoramento — os dois se
          fecham como um bloco só, e é por isso que o token tem nome de papel e
          não de componente. */}
      <LinearGradient
        colors={[colors.neutro0, colors.superficieRosada]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.card}
      >
        <View style={styles.icone}>
          <Ionicons name="chatbubble-ellipses" size={20} color={colors.rosa700} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Converse com a Ninna</Text>
          <Text style={styles.subtitulo}>
            Pergunte sobre horários, quantidades e o que vem se repetindo nos registros de{' '}
            {nomeBebe}.
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.neutro300} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.conversa,
    borderWidth: 1,
    borderColor: colors.bordaRosada,
    padding: spacing.md,
    marginBottom: spacing.respiro,
  },
  icone: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.rosa100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { ...typography.tituloCard, color: colors.headline },
  subtitulo: { ...typography.itemRotulo, color: colors.neutro500 },
});
