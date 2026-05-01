import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ClearLensCard,
  ClearLensHeader,
  ClearLensScreen,
} from '@/src/components/clearLens/ClearLensPrimitives';
import { useToolsFeatureFlags } from '@/src/hooks/useToolsFeatureFlags';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToolStatus = 'available' | 'coming-soon';

interface ToolDef {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  name: string;
  subtitle: string;
  status: ToolStatus;
  route?: string;
}

interface ToolSection {
  label: string;
  tools: ToolDef[];
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function ClearLensToolsScreen() {
  const router = useRouter();
  const flags = useToolsFeatureFlags();

  const sections: ToolSection[] = [
    {
      label: 'FEATURED',
      tools: [
        {
          key: 'wealth-journey',
          icon: 'calculator-outline',
          name: 'Wealth Journey',
          subtitle: 'See what your portfolio could become.',
          status: 'available',
          route: '/(tabs)/wealth-journey',
        },
      ],
    },
    {
      label: 'PLAN',
      tools: [
        {
          key: 'goal-planner',
          icon: 'flag-outline',
          name: 'Goal Planner',
          subtitle: 'Find the monthly investment needed for a goal.',
          status: flags.goalPlanner ? 'available' : 'coming-soon',
          route: flags.goalPlanner ? '/tools/goal-planner' : undefined,
        },
      ],
    },
    {
      label: 'COMPARE',
      tools: [
        {
          key: 'compare-funds',
          icon: 'bar-chart-outline',
          name: 'Compare Funds',
          subtitle: 'Compare up to 3 funds side by side.',
          status: flags.compareFunds ? 'available' : 'coming-soon',
          route: flags.compareFunds ? '/tools/compare-funds' : undefined,
        },
      ],
    },
    {
      label: 'EXPLORE',
      tools: [
        {
          key: 'past-sip-check',
          icon: 'time-outline',
          name: 'Past SIP Check',
          subtitle: 'See how a monthly SIP would have performed.',
          status: flags.pastSipCheck ? 'available' : 'coming-soon',
          route: flags.pastSipCheck ? '/tools/past-sip-check' : undefined,
        },
      ],
    },
    {
      label: 'COST & FEES',
      tools: [
        {
          key: 'direct-vs-regular',
          icon: 'trending-down-outline',
          name: 'Direct vs Regular Impact',
          subtitle: 'See how plan costs can affect long-term returns.',
          status: flags.directVsRegular ? 'available' : 'coming-soon',
          route: flags.directVsRegular ? '/tools/direct-vs-regular' : undefined,
        },
      ],
    },
  ];

  function handleToolPress(tool: ToolDef) {
    if (tool.status === 'available' && tool.route) {
      router.push(tool.route as Parameters<typeof router.push>[0]);
    }
  }

  return (
    <ClearLensScreen>
      <ClearLensHeader title="Tools" onPressBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section) => (
          <View key={section.label} style={styles.section}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            {section.tools.map((tool) => (
              <ToolCard key={tool.key} tool={tool} onPress={() => handleToolPress(tool)} />
            ))}
          </View>
        ))}

        <Text style={styles.disclaimer}>
          All results are estimates based on assumptions and historical data. Past performance is
          not indicative of future returns. No recommendations or advice.
        </Text>
      </ScrollView>

    </ClearLensScreen>
  );
}

// ---------------------------------------------------------------------------
// ToolCard
// ---------------------------------------------------------------------------

function ToolCard({ tool, onPress }: { tool: ToolDef; onPress: () => void }) {
  const isAvailable = tool.status === 'available';

  const content = (
    <ClearLensCard style={isAvailable ? styles.toolCard : [styles.toolCard, styles.toolCardMuted]}>
      <View style={styles.toolIconWrap}>
        <Ionicons
          name={tool.icon}
          size={22}
          color={isAvailable ? ClearLensColors.emerald : ClearLensColors.textTertiary}
        />
      </View>
      <View style={styles.toolInfo}>
        <Text style={[styles.toolName, !isAvailable && styles.toolNameMuted]}>{tool.name}</Text>
        <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
      </View>
      <View style={styles.toolTrailing}>
        {isAvailable ? (
          <Ionicons name="chevron-forward" size={18} color={ClearLensColors.emerald} />
        ) : (
          <View style={styles.comingSoonPill}>
            <Text style={styles.comingSoonText}>Soon</Text>
          </View>
        )}
      </View>
    </ClearLensCard>
  );

  if (!isAvailable) {
    return content;
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} accessibilityRole="button">
      {content}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingTop: ClearLensSpacing.xs,
    paddingBottom: ClearLensSpacing.xxl,
    gap: ClearLensSpacing.lg,
  },
  section: {
    gap: ClearLensSpacing.sm,
  },
  sectionLabel: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    letterSpacing: 1.2,
    paddingHorizontal: ClearLensSpacing.xs,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.md,
    paddingVertical: ClearLensSpacing.md,
    paddingHorizontal: ClearLensSpacing.md,
  },
  toolCardMuted: {
    opacity: 0.6,
  },
  toolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: ClearLensRadii.sm,
    backgroundColor: ClearLensColors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  toolInfo: {
    flex: 1,
    gap: 2,
  },
  toolName: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  toolNameMuted: {
    color: ClearLensColors.textSecondary,
  },
  toolSubtitle: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
  },
  toolTrailing: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonPill: {
    paddingHorizontal: ClearLensSpacing.sm,
    paddingVertical: 3,
    borderRadius: ClearLensRadii.full,
    backgroundColor: ClearLensColors.surfaceSoft,
    borderWidth: 1,
    borderColor: ClearLensColors.borderLight,
  },
  comingSoonText: {
    fontFamily: ClearLensFonts.semiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
    color: ClearLensColors.textTertiary,
    textTransform: 'uppercase',
  },
  disclaimer: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: ClearLensSpacing.md,
    lineHeight: 17,
  },
});

