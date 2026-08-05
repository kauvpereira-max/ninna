import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function Screen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>ninna</Text>
        <Text style={styles.subtitle}>Tela ainda não implementada — placeholder do esqueleto inicial.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutro50 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  title: { ...typography.h1, color: colors.headline, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.neutro500, textAlign: 'center' },
});
