import { useCallback } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ClearLensHeader, ClearLensScreen } from '@/src/components/clearLens/ClearLensPrimitives';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensShadow,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';
import { useAppStore, type SavedGoal } from '@/src/store/appStore';
import { computeGoalPlan, assumptionsToRates, yearsFromNow } from '@/src/utils/goalPlanner';
import { formatCurrency } from '@/src/utils/formatting';

export function ClearLensGoalPlannerScreen() {
  const router = useRouter();
  const { goals, returnAssumptions } = useAppStore();

  const rates = assumptionsToRates(returnAssumptions);

  const handleAdd = useCallback(() => {
    router.push('/tools/goal-planner/create');
  }, [router]);

  if (goals.length === 0) {
    return (
      <ClearLensScreen>
        <ClearLensHeader onPressBack={() => router.back()} />
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="flag-outline" size={36} color={ClearLensColors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No goals yet</Text>
          <Text style={styles.emptySubtitle}>
            Add a financial goal — retirement, home, education — and see exactly how much you need to invest each month.
          </Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAdd} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color={ClearLensColors.textOnDark} />
            <Text style={styles.addButtonText}>Add your first goal</Text>
          </TouchableOpacity>
        </View>
      </ClearLensScreen>
    );
  }

  return (
    <ClearLensScreen>
      <ClearLensHeader onPressBack={() => router.back()} />
      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <GoalCard goal={item} rates={rates} />
        )}
        ListFooterComponent={
          <TouchableOpacity style={styles.addRowButton} onPress={handleAdd} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={18} color={ClearLensColors.emerald} />
            <Text style={styles.addRowText}>Add another goal</Text>
          </TouchableOpacity>
        }
      />
    </ClearLensScreen>
  );
}

function GoalCard({
  goal,
  rates,
}: {
  goal: SavedGoal;
  rates: Record<string, number>;
}) {
  const router = useRouter();
  const years = yearsFromNow(goal.targetDate);
  const plan = computeGoalPlan(
    {
      targetAmount: goal.targetAmount,
      years,
      lumpSum: goal.lumpSum,
      currentMonthly: goal.currentMonthly,
      returnPreset: goal.returnPreset,
    },
    rates,
  );

  const presetLabel = goal.returnPreset.charAt(0).toUpperCase() + goal.returnPreset.slice(1);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() => router.push(`/tools/goal-planner/${goal.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.goalName} numberOfLines={1}>{goal.name}</Text>
          <Ionicons name="chevron-forward" size={16} color={ClearLensColors.textTertiary} />
        </View>
        <View style={styles.tagRow}>
          <View style={[styles.tag, plan.onTrack ? styles.tagGreen : styles.tagAmber]}>
            <Text style={[styles.tagText, plan.onTrack ? styles.tagTextGreen : styles.tagTextAmber]}>
              {plan.onTrack ? 'On track' : 'Needs attention'}
            </Text>
          </View>
          <Text style={styles.metaText}>{presetLabel} · {years > 0 ? `${Math.round(years)}y` : 'Overdue'}</Text>
        </View>
      </View>

      <View style={styles.cardMetrics}>
        <Metric label="Target" value={formatCurrency(goal.targetAmount)} />
        <View style={styles.divider} />
        <Metric label="Monthly needed" value={formatCurrency(plan.requiredMonthly)} />
        <View style={styles.divider} />
        <Metric
          label={plan.onTrack ? 'Surplus' : 'Gap'}
          value={formatCurrency(Math.abs(plan.gap))}
          tone={plan.onTrack ? 'positive' : 'negative'}
        />
      </View>
    </TouchableOpacity>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[
        styles.metricValue,
        tone === 'positive' && { color: ClearLensColors.positive },
        tone === 'negative' && { color: ClearLensColors.negative },
      ]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ClearLensSpacing.xl,
    gap: ClearLensSpacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ClearLensColors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ClearLensSpacing.xs,
  },
  emptyTitle: {
    ...ClearLensTypography.h2,
    color: ClearLensColors.navy,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: ClearLensSpacing.md,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ClearLensColors.emerald,
    paddingHorizontal: ClearLensSpacing.lg,
    paddingVertical: ClearLensSpacing.sm + 2,
    borderRadius: ClearLensRadii.md,
    gap: ClearLensSpacing.xs,
  },
  addButtonText: {
    fontFamily: ClearLensFonts.semiBold,
    fontSize: 15,
    color: ClearLensColors.textOnDark,
  },

  listContent: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingTop: ClearLensSpacing.xs,
    paddingBottom: ClearLensSpacing.xxl,
    gap: ClearLensSpacing.sm,
  },
  card: {
    backgroundColor: ClearLensColors.surface,
    borderRadius: ClearLensRadii.lg,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    ...ClearLensShadow,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingTop: ClearLensSpacing.md,
    paddingBottom: ClearLensSpacing.sm,
    gap: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalName: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  tag: {
    paddingHorizontal: ClearLensSpacing.xs,
    paddingVertical: 2,
    borderRadius: ClearLensRadii.sm,
  },
  tagGreen: { backgroundColor: ClearLensColors.positiveBg },
  tagAmber: { backgroundColor: ClearLensColors.warningBg },
  tagText: {
    fontFamily: ClearLensFonts.semiBold,
    fontSize: 11,
  },
  tagTextGreen: { color: ClearLensColors.positive },
  tagTextAmber: { color: ClearLensColors.warning },
  metaText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  cardMetrics: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: ClearLensColors.borderLight,
  },
  metric: {
    flex: 1,
    paddingVertical: ClearLensSpacing.sm,
    paddingHorizontal: ClearLensSpacing.sm,
    gap: 2,
  },
  metricLabel: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  metricValue: {
    fontFamily: ClearLensFonts.semiBold,
    fontSize: 13,
    color: ClearLensColors.navy,
  },
  divider: {
    width: 1,
    backgroundColor: ClearLensColors.borderLight,
  },
  addRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ClearLensSpacing.xs,
    paddingVertical: ClearLensSpacing.md,
  },
  addRowText: {
    fontFamily: ClearLensFonts.semiBold,
    fontSize: 14,
    color: ClearLensColors.emerald,
  },
});
