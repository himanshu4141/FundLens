import { ReactNode } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ClearLensColors,
  ClearLensRadii,
  ClearLensShadow,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';
import { FundLensLogo } from '@/src/components/clearLens/FundLensLogo';

export function ClearLensScreen({ children }: { children: ReactNode }) {
  return <SafeAreaView style={styles.screen}>{children}</SafeAreaView>;
}

export function ClearLensCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ClearLensHeader({
  onPressMenu,
  onPressBack,
  title,
  showTagline = false,
}: {
  onPressMenu?: () => void;
  onPressBack?: () => void;
  title?: string;
  showTagline?: boolean;
}) {
  return (
    <View style={styles.header}>
      {onPressBack ? (
        <TouchableOpacity onPress={onPressBack} style={styles.iconButton} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={22} color={ClearLensColors.navy} />
        </TouchableOpacity>
      ) : (
        <FundLensLogo size={34} showTagline={showTagline} />
      )}

      {title ? <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text> : <View style={styles.headerSpacer} />}

      {onPressMenu ? (
        <TouchableOpacity onPress={onPressMenu} style={styles.iconButton} activeOpacity={0.75}>
          <Ionicons name="ellipsis-horizontal" size={22} color={ClearLensColors.navy} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconButtonGhost} />
      )}
    </View>
  );
}

export function ClearLensSegmentedControl<T extends string>({
  options,
  selected,
  onChange,
}: {
  options: { value: T; label: string }[];
  selected: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && styles.segmentActive]}
            activeOpacity={0.75}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function ClearLensMetricCard({
  label,
  value,
  tone = 'neutral',
  sublabel,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
  sublabel?: string;
}) {
  const valueStyle: TextStyle =
    tone === 'positive'
      ? { color: ClearLensColors.emerald }
      : tone === 'negative'
        ? { color: ClearLensColors.negative }
        : { color: ClearLensColors.navy };

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, valueStyle]}>{value}</Text>
      {sublabel ? <Text style={styles.metricSub}>{sublabel}</Text> : null}
    </View>
  );
}

export function ClearLensPill({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
      activeOpacity={0.75}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ClearLensColors.background,
  },
  card: {
    backgroundColor: ClearLensColors.surface,
    borderRadius: ClearLensRadii.lg,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    padding: ClearLensSpacing.md,
    ...ClearLensShadow,
  },
  header: {
    minHeight: 58,
    paddingHorizontal: ClearLensSpacing.md,
    paddingTop: 2,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    backgroundColor: ClearLensColors.background,
  },
  headerTitle: {
    ...ClearLensTypography.h3,
    flex: 1,
    color: ClearLensColors.navy,
    textAlign: 'center',
  },
  headerSpacer: {
    flex: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconButtonGhost: {
    width: 40,
    height: 40,
  },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.surfaceSoft,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ClearLensRadii.sm,
  },
  segmentActive: {
    backgroundColor: ClearLensColors.navy,
    borderWidth: 1,
    borderColor: ClearLensColors.navy,
    ...ClearLensShadow,
    shadowOpacity: 0.04,
    elevation: 1,
  },
  segmentText: {
    ...ClearLensTypography.bodySmall,
    fontWeight: '600',
    color: ClearLensColors.textTertiary,
  },
  segmentTextActive: {
    color: ClearLensColors.textOnDark,
  },
  metricCard: {
    flex: 1,
    padding: ClearLensSpacing.sm,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.surfaceSoft,
    gap: 3,
  },
  metricLabel: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    textTransform: 'uppercase',
  },
  metricValue: {
    ...ClearLensTypography.h3,
  },
  metricSub: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  pill: {
    minHeight: 38,
    paddingHorizontal: ClearLensSpacing.md,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.surfaceSoft,
  },
  pillActive: {
    backgroundColor: ClearLensColors.navy,
  },
  pillText: {
    ...ClearLensTypography.bodySmall,
    fontWeight: '600',
    color: ClearLensColors.textTertiary,
  },
  pillTextActive: {
    color: ClearLensColors.textOnDark,
  },
});
