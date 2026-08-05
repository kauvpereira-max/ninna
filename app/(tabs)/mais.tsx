import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { Button } from '../../src/components/Button';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function MaisScreen() {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Mais</Text>
        <Text style={styles.subtitle}>Logada como {user?.email}</Text>
        <Button label="Sair da conta" variant="secondary" onPress={signOut} style={{ marginTop: spacing.xl }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutro50 },
  content: { flex: 1, padding: spacing.lg, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.h1, color: colors.headline, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.neutro500 },
});
