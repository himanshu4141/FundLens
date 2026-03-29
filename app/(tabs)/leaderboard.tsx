import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/AppScreenHeader';
import { useThemeVariant } from '@/src/hooks/useThemeVariant';

export default function LeaderboardScreen() {
  const theme = useThemeVariant();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <AppScreenHeader
        title="Leaderboard"
        subtitle="A dedicated ranked funds view lands in the next milestone."
      />
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Coming next</Text>
        <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
          This tab is now part of the app shell. Ranking logic and cards land in the next milestone.
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
