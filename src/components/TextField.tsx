import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function TextField({ label, error, style, ...rest }: FieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, style as any]}
        placeholderTextColor={colors.neutro300}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.neutro500, marginBottom: 4 },
  input: {
    ...typography.bodyLarge,
    color: colors.headline,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.rosa500,
    paddingVertical: spacing.sm,
  },
  error: { ...typography.caption, color: colors.coral600, marginTop: 4 },
});
