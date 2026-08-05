import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../theme/tokens';

export type Opcao<T extends string> = { value: T; label: string };

type ChipGroupProps<T extends string> = {
  label: string;
  options: Opcao<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
};

export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: ChipGroupProps<T>) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((opcao) => {
          const ativo = opcao.value === value;
          return (
            <Pressable
              key={opcao.value}
              onPress={() => onChange(opcao.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              style={[styles.chip, ativo && styles.chipAtivo]}
            >
              <Text style={[styles.chipLabel, ativo && styles.chipLabelAtivo]}>{opcao.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.neutro500, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.neutro200,
    backgroundColor: colors.neutro0,
  },
  chipAtivo: { borderColor: colors.rosa500, backgroundColor: colors.rosa100 },
  chipLabel: { ...typography.body, color: colors.neutro600 },
  chipLabelAtivo: { color: colors.rosa700, fontFamily: 'NunitoSans_600SemiBold' },
  error: { ...typography.caption, color: colors.coral600, marginTop: 4 },
});
