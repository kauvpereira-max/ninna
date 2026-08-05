import { Pressable, Text, StyleSheet, ActivityIndicator, PressableProps } from 'react-native';
import { colors, spacing, radius, typography } from '../theme/tokens';

type ButtonProps = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
};

export function Button({ label, variant = 'primary', loading, style, disabled, ...rest }: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      style={[
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        (disabled || loading) && styles.disabled,
        style as any,
      ]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.neutro0 : colors.rosa500} />
      ) : (
        <Text style={isPrimary ? styles.primaryLabel : styles.secondaryLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.rosa500 },
  secondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.rosa200 },
  disabled: { opacity: 0.5 },
  primaryLabel: { ...typography.label, fontSize: 15, color: colors.neutro0 },
  secondaryLabel: { ...typography.label, fontSize: 15, color: colors.neutro600 },
});
