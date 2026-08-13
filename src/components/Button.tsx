import { Pressable, Text, StyleSheet, ActivityIndicator, PressableProps } from 'react-native';
import { colors, radius, typography, elevation } from '../theme/tokens';

type ButtonProps = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
};

export function Button({ label, variant = 'primary', loading, style, disabled, ...rest }: ButtonProps) {
  const isPrimary = variant === 'primary';

  /**
   * Desabilitado e carregando são estados DIFERENTES, e o protótipo só desenha
   * o primeiro.
   *
   * Desabilitado é "falta escolher alguma coisa": o botão fica rosa pálido, sem
   * sombra, e é isso que o protótipo pinta. Carregando é a ação acontecendo —
   * o botão continua sendo o botão, com a cor e o brilho dele, só não aceita um
   * segundo toque.
   *
   * Antes os dois caíam no mesmo `opacity: 0.5`. Somando a mudança de cor, um
   * spinner branco sobre fundo pálido seria o resultado — visivelmente errado
   * num estado que a mãe vê toda vez que salva um registro.
   */
  const desabilitado = !!disabled && !loading;
  const bloqueado = !!disabled || !!loading;

  return (
    <Pressable
      style={[
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        // A sombra colorida some no desabilitado, como no protótipo — e some
        // por ausência, não por opacidade.
        isPrimary && !desabilitado && elevation.ctaRosa,
        desabilitado && (isPrimary ? styles.primarioDesabilitado : styles.secundarioDesabilitado),
        style as any,
      ]}
      disabled={bloqueado}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.neutro0 : colors.rosa500} />
      ) : (
        <Text
          style={[
            isPrimary ? styles.primaryLabel : styles.secondaryLabel,
            // Só o primário: o secundário já esmaece inteiro, e as duas coisas
            // somadas deixariam o texto ilegível.
            desabilitado && isPrimary && styles.labelDesabilitado,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    // 54 no protótipo, contra os 52 de antes.
    height: 54,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.rosa500 },
  secondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.rosa200 },
  primarioDesabilitado: { backgroundColor: colors.desabilitadoFundo },
  // O secundário não tem estado desenhado no protótipo: ele é borda sobre fundo
  // transparente, e não há o que despintar. Segue esmaecendo.
  secundarioDesabilitado: { opacity: 0.5 },
  primaryLabel: { ...typography.cta, color: colors.neutro0 },
  secondaryLabel: { ...typography.cta, color: colors.neutro600 },
  labelDesabilitado: { color: colors.desabilitadoTexto },
});
