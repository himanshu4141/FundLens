import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { Spacing, Radii, Typography } from '@/src/constants/theme';
import type { PortfolioInsights } from '@/src/types/app';

interface Props {
  insights: PortfolioInsights | null;
  isLoading: boolean;
  isStale: boolean;
  isSyncing: boolean;
  onSyncPress: () => void;
}

const ASSET_COLORS = {
  equity: '#ef4444',
  debt: '#3b82f6',
  cash: '#f97316',
  other: '#a78bfa',
};

export function PortfolioInsightsEntryCard({
  insights,
  isLoading,
  isStale,
  isSyncing,
  onSyncPress,
}: Props) {
  const { colors } = useTheme();
  const router = useRouter();

  const handlePress = () => {
    router.push('/portfolio-insights');
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header row */}
      <TouchableOpacity style={styles.header} onPress={handlePress} activeOpacity={0.7}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Portfolio Insights</Text>
        <View style={styles.headerRight}>
          {(isStale || isSyncing) && (
            <TouchableOpacity
              onPress={onSyncPress}
              disabled={isSyncing}
              style={styles.syncBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isSyncing
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Ionicons name="refresh-outline" size={16} color={colors.textTertiary} />
              }
            </TouchableOpacity>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
        {isLoading ? (
          <View style={styles.skeleton}>
            <View style={[styles.skeletonBar, { backgroundColor: colors.borderLight }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.borderLight }]} />
          </View>
        ) : insights ? (
          <>
            {/* Stacked bar */}
            <View style={styles.stackedBar}>
              {insights.assetMix.equity > 0.5 && (
                <View style={[styles.barSeg, { flex: insights.assetMix.equity, backgroundColor: ASSET_COLORS.equity }]} />
              )}
              {insights.assetMix.debt > 0.5 && (
                <View style={[styles.barSeg, { flex: insights.assetMix.debt, backgroundColor: ASSET_COLORS.debt }]} />
              )}
              {insights.assetMix.cash > 0.5 && (
                <View style={[styles.barSeg, { flex: insights.assetMix.cash, backgroundColor: ASSET_COLORS.cash }]} />
              )}
              {insights.assetMix.other > 0.5 && (
                <View style={[styles.barSeg, { flex: insights.assetMix.other, backgroundColor: ASSET_COLORS.other }]} />
              )}
            </View>

            {/* Key stats row */}
            <View style={styles.statsRow}>
              <StatPill
                label={`${insights.assetMix.equity.toFixed(0)}% Equity`}
                color={ASSET_COLORS.equity}
                textColor={colors.textSecondary}
              />
              <Text style={[styles.dot, { color: colors.textTertiary }]}>·</Text>
              <StatPill
                label={`${insights.marketCapMix.large.toFixed(0)}% Large Cap`}
                color="#3b82f6"
                textColor={colors.textSecondary}
              />
              {insights.sectorBreakdown && (
                <>
                  <Text style={[styles.dot, { color: colors.textTertiary }]}>·</Text>
                  <StatPill
                    label={`${insights.sectorBreakdown.length} Sectors`}
                    color={colors.primary}
                    textColor={colors.textSecondary}
                  />
                </>
              )}
            </View>

            {/* Source badge */}
            <Text style={[styles.sourceBadge, { color: colors.textTertiary }]}>
              {insights.dataSource === 'amfi'
                ? `AMFI disclosure · ${formatDate(insights.dataAsOf)}`
                : 'Estimated · Based on fund category'}
            </Text>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Tap to load portfolio composition
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

function StatPill({ label, color, textColor }: { label: string; color: string; textColor: string }) {
  return (
    <Text style={[styles.statPill, { color: textColor }]}>
      {label}
    </Text>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
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
  syncBtn: {
    padding: 2,
  },
  stackedBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: Radii.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  barSeg: {
    height: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  statPill: {
    ...Typography.bodySmall,
    fontWeight: '500',
  },
  dot: {
    ...Typography.bodySmall,
  },
  sourceBadge: {
    ...Typography.caption,
  },
  skeleton: {
    gap: Spacing.sm,
  },
  skeletonBar: {
    height: 10,
    borderRadius: Radii.full,
  },
  skeletonLine: {
    height: 14,
    borderRadius: Radii.sm,
    width: '60%',
  },
  emptyState: {
    paddingVertical: Spacing.sm,
  },
  emptyText: {
    ...Typography.bodySmall,
  },
});
