import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { Spacing, Radii, Typography } from '@/src/constants/theme';
import { formatCurrency } from '@/src/utils/formatting';
import type { InsightFundAllocation } from '@/src/types/app';

interface Props {
  fundAllocation: InsightFundAllocation[];
  fundCount: number;
}

export function YourFundsEntryCard({ fundAllocation, fundCount }: Props) {
  const { colors } = useTheme();
  const router = useRouter();

  const handlePress = () => {
    router.push('/funds');
  };

  const top3 = fundAllocation.slice(0, 3);

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.header} onPress={handlePress} activeOpacity={0.7}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Your Funds</Text>
        <View style={styles.headerRight}>
          <Text style={[styles.countText, { color: colors.textTertiary }]}>
            {fundCount} fund{fundCount !== 1 ? 's' : ''}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
        {fundAllocation.length > 0 && (
          <>
            <View style={styles.allocationBar}>
              {fundAllocation.slice(0, 8).map((f) => (
                <View
                  key={f.fundId}
                  style={[styles.barSeg, { flex: f.pct, backgroundColor: f.color }]}
                />
              ))}
            </View>

            <View style={styles.fundList}>
              {top3.map((f) => (
                <View key={f.fundId} style={styles.fundRow}>
                  <View style={[styles.fundDot, { backgroundColor: f.color }]} />
                  <Text style={[styles.fundName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {f.shortName}
                  </Text>
                  <Text style={[styles.fundPct, { color: colors.textTertiary }]}>
                    {f.pct.toFixed(1)}%
                  </Text>
                  <Text style={[styles.fundValue, { color: colors.textSecondary }]}>
                    {formatCurrency(f.value)}
                  </Text>
                </View>
              ))}
              {fundCount > 3 && (
                <Text style={[styles.moreText, { color: colors.textTertiary }]}>
                  +{fundCount - 3} more · tap to see all
                </Text>
              )}
            </View>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.h3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  countText: {
    fontSize: 13,
    fontWeight: '500',
  },
  allocationBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: Radii.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  barSeg: {
    height: '100%',
  },
  fundList: {
    gap: 6,
  },
  fundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  fundDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  fundName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  fundPct: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  fundValue: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 72,
    textAlign: 'right',
  },
  moreText: {
    fontSize: 12,
    marginTop: 2,
  },
});
