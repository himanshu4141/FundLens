import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Logo from '@/src/components/Logo';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';

export default function SimulatorScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header — matches Home screen pattern */}
      <LinearGradient
        colors={Colors.gradientHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Logo size={28} showWordmark light />
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} hitSlop={8}>
          <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Placeholder body */}
      <View style={styles.body}>
        <Ionicons name="calculator-outline" size={56} color={Colors.textTertiary} />
        <Text style={styles.title}>Wealth Simulator</Text>
        <Text style={styles.subtitle}>
          Adjust your SIP amount, add a lumpsum, or change your return expectation — and see
          how small changes today can transform your wealth over 15 years.
        </Text>
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>Coming in M6</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  comingSoonBadge: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  comingSoonText: {
    ...Typography.label,
    color: Colors.primary,
  },
});
