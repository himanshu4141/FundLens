import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, BENCHMARK_OPTIONS } from '@/src/store/appStore';
import { UtilityHeader } from '@/src/components/UtilityHeader';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensShadow,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';

const DESIGN_OPTIONS = [
  { value: 'classic' as const, label: 'Current design', desc: 'Classic FundLens look' },
  { value: 'clearLens' as const, label: 'Clear Lens design', desc: 'New clean and minimal design' },
];

export default function PreferencesScreen() {
  const styles = useMemo(() => makeStyles(), []);
  const { defaultBenchmarkSymbol, setDefaultBenchmarkSymbol, appDesignMode, setAppDesignMode } = useAppStore();
  const [saved, setSaved] = useState(false);

  function selectBenchmark(symbol: string) {
    setDefaultBenchmarkSymbol(symbol);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <SafeAreaView style={styles.container}>
      <UtilityHeader title="Preferences" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Default benchmark */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Default Benchmark</Text>
          {saved && <Text style={styles.savedBadge}>✓ Saved</Text>}
        </View>
        <Text style={styles.sectionDesc}>
          Used for &ldquo;You vs Market&rdquo; on the home screen
        </Text>
        <View style={styles.card}>
          {BENCHMARK_OPTIONS.map((opt, idx) => (
            <TouchableOpacity
              key={opt.symbol}
              style={[styles.row, idx > 0 && styles.borderTop]}
              onPress={() => selectBenchmark(opt.symbol)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowValue, { flex: 1 }]}>{opt.label}</Text>
              {defaultBenchmarkSymbol === opt.symbol && (
                <Ionicons name="checkmark" size={18} color={ClearLensColors.emerald} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* App design */}
        <Text style={[styles.sectionLabel, { marginTop: ClearLensSpacing.md }]}>App Design</Text>
        <View style={styles.card}>
          {DESIGN_OPTIONS.map((option, idx) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.row, idx > 0 && styles.borderTop]}
              onPress={() => setAppDesignMode(option.value)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowValue}>{option.label}</Text>
                <Text style={styles.rowSub}>{option.desc}</Text>
              </View>
              <Ionicons
                name={appDesignMode === option.value ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={appDesignMode === option.value ? ClearLensColors.emerald : ClearLensColors.textTertiary}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: ClearLensColors.background },
    content: { padding: ClearLensSpacing.md, gap: ClearLensSpacing.xs, paddingBottom: ClearLensSpacing.xxl },

    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: ClearLensSpacing.xs,
    },
    sectionLabel: {
      ...ClearLensTypography.label,
      color: ClearLensColors.textTertiary,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    sectionDesc: {
      ...ClearLensTypography.bodySmall,
      color: ClearLensColors.textTertiary,
      marginBottom: ClearLensSpacing.xs,
    },
    savedBadge: {
      ...ClearLensTypography.caption,
      fontFamily: ClearLensFonts.semiBold,
      color: ClearLensColors.emerald,
    },

    card: {
      backgroundColor: ClearLensColors.surface,
      borderRadius: ClearLensRadii.lg,
      borderWidth: 1,
      borderColor: ClearLensColors.border,
      overflow: 'hidden',
      ...ClearLensShadow,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: ClearLensSpacing.md,
      paddingVertical: 14,
      gap: ClearLensSpacing.md,
    },
    borderTop: { borderTopWidth: 1, borderTopColor: ClearLensColors.borderLight },
    rowLeft: { flex: 1, gap: 3 },
    rowValue: {
      ...ClearLensTypography.h3,
      color: ClearLensColors.navy,
    },
    rowSub: {
      ...ClearLensTypography.bodySmall,
      color: ClearLensColors.textTertiary,
    },
  });
}
