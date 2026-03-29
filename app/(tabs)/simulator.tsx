import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/AppScreenHeader';
import { useThemeVariant } from '@/src/hooks/useThemeVariant';

export default function SimulatorScreen() {
  const theme = useThemeVariant();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <AppScreenHeader
        title="Simulator"
        subtitle="Projection controls land in the simulator milestone."
      />
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Simulator shell ready</Text>
        <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
          The navigation slot is live. Projection math, controls, and charts land in a dedicated commit.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderRadius: 20,
    margin: 16,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
});
