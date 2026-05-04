import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FolioLensLogo } from '@/src/components/clearLens/FolioLensLogo';
import { useSession } from '@/src/hooks/useSession';
import { supabase } from '@/src/lib/supabase';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';
import { SidebarWidth } from './desktopBreakpoints';

type SyncState = 'idle' | 'syncing' | 'requested' | 'error';

type NavItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  match: (segments: string[]) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: 'portfolio',
    label: 'Portfolio',
    icon: 'pie-chart-outline',
    href: '/(tabs)',
    match: (segments) => segments[0] === '(tabs)' && (segments[1] === 'index' || segments[1] === undefined),
  },
  {
    key: 'funds',
    label: 'Funds',
    icon: 'list-outline',
    href: '/(tabs)/leaderboard',
    match: (segments) => segments[0] === '(tabs)' && segments[1] === 'leaderboard',
  },
  {
    key: 'wealth',
    label: 'Wealth Journey',
    icon: 'calculator-outline',
    href: '/(tabs)/wealth-journey',
    match: (segments) => segments[0] === '(tabs)' && segments[1] === 'wealth-journey',
  },
];

const QUICK_ACTIONS: { key: 'sync' | 'import' | 'trail' | 'tools'; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: 'sync', icon: 'sync-outline', label: 'Sync portfolio' },
  { key: 'import', icon: 'cloud-upload-outline', label: 'Import CAS' },
  { key: 'trail', icon: 'trail-sign-outline', label: 'Money Trail' },
  { key: 'tools', icon: 'construct-outline', label: 'Tools' },
];

export function DesktopSidebar() {
  const router = useRouter();
  const segments = useSegments();
  const { session } = useSession();
  const userId = session?.user.id;
  const accountMetadata = session?.user.user_metadata as { full_name?: string; name?: string } | undefined;
  const accountLabel = accountMetadata?.full_name ?? accountMetadata?.name ?? session?.user.email ?? null;
  const accountInitial = useMemo(() => getAccountInitial(accountLabel), [accountLabel]);
  const [syncState, setSyncState] = useState<SyncState>('idle');

  const { data: profile } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profile')
        .select('kfintech_email')
        .eq('user_id', userId!)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  async function handleSync() {
    if (!profile?.kfintech_email) {
      router.push('/onboarding');
      return;
    }
    setSyncState('syncing');
    const { error } = await supabase.functions.invoke('request-cas', {
      method: 'POST',
      body: { email: profile.kfintech_email },
    });
    setSyncState(error ? 'error' : 'requested');
    setTimeout(() => setSyncState('idle'), 4000);
  }

  function handleQuickAction(key: 'sync' | 'import' | 'trail' | 'tools') {
    if (key === 'sync') return handleSync();
    if (key === 'import') {
      router.push(profile?.kfintech_email ? '/onboarding/pdf' : '/onboarding');
      return;
    }
    if (key === 'trail') return router.push('/money-trail');
    if (key === 'tools') return router.push('/tools' as never);
  }

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandBlock}>
        <FolioLensLogo size={32} showWordmark />
      </View>

      <Text style={styles.sectionLabel}>Navigate</Text>
      <View style={styles.navGroup}>
        {NAV_ITEMS.map((item) => {
          const active = item.match(segments as string[]);
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => router.push(item.href as never)}
              activeOpacity={0.78}
            >
              <Ionicons
                name={item.icon}
                size={18}
                color={active ? ClearLensColors.textOnDark : ClearLensColors.slate}
              />
              <Text
                style={[
                  styles.navLabel,
                  { color: active ? ClearLensColors.textOnDark : ClearLensColors.slate },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Quick actions</Text>
      <View style={styles.quickGroup}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={styles.quickItem}
            onPress={() => handleQuickAction(action.key)}
            activeOpacity={0.78}
          >
            {action.key === 'sync' && syncState === 'syncing' ? (
              <ActivityIndicator size="small" color={ClearLensColors.emerald} />
            ) : (
              <Ionicons name={action.icon} size={16} color={ClearLensColors.slate} />
            )}
            <Text style={styles.quickLabel} numberOfLines={1}>{action.label}</Text>
          </TouchableOpacity>
        ))}
        {syncState === 'requested' && (
          <View style={styles.syncBanner}>
            <Text style={styles.syncBannerText}>
              CAS requested — forward the email when it arrives.
            </Text>
          </View>
        )}
        {syncState === 'error' && (
          <View style={[styles.syncBanner, styles.syncBannerError]}>
            <Text style={[styles.syncBannerText, styles.syncBannerTextError]}>
              Sync failed. Try again.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.spacer} />

      {/* The account row is a direct link to Settings — every other item
          surfaced by the legacy account dropdown (Sync, Import, Money Trail,
          Tools) is already in this sidebar, and Sign Out lives inside
          Settings → About & support. Keeps one entry point per action. */}
      <TouchableOpacity
        style={styles.accountRow}
        onPress={() => router.push('/(tabs)/settings')}
        activeOpacity={0.8}
        accessibilityRole="link"
        accessibilityLabel="Open settings"
      >
        <View style={styles.accountBadge}>
          <Text style={styles.accountInitial}>{accountInitial}</Text>
        </View>
        <View style={styles.accountText}>
          <Text style={styles.accountName} numberOfLines={1}>
            {accountLabel ?? 'Signed in'}
          </Text>
          <Text style={styles.accountAction}>Account · settings</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={ClearLensColors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

function getAccountInitial(label?: string | null): string {
  const trimmed = label?.trim();
  if (!trimmed) return '?';
  const namePart = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
  const firstLetter = namePart.match(/[A-Za-z0-9]/)?.[0];
  return firstLetter ? firstLetter.toUpperCase() : '?';
}

const styles = StyleSheet.create({
  sidebar: {
    width: SidebarWidth,
    alignSelf: 'stretch',
    height: '100%',
    backgroundColor: ClearLensColors.surface,
    borderRightWidth: 1,
    borderRightColor: ClearLensColors.borderLight,
    paddingHorizontal: ClearLensSpacing.md,
    paddingVertical: ClearLensSpacing.lg,
    gap: ClearLensSpacing.md,
  },
  brandBlock: {
    paddingVertical: ClearLensSpacing.xs,
  },
  sectionLabel: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    textTransform: 'uppercase',
    paddingHorizontal: 6,
    marginTop: ClearLensSpacing.xs,
  },
  navGroup: {
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    paddingHorizontal: ClearLensSpacing.sm,
    paddingVertical: 10,
    borderRadius: ClearLensRadii.md,
  },
  navItemActive: {
    backgroundColor: ClearLensColors.navy,
  },
  navLabel: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.semiBold,
  },
  quickGroup: {
    gap: 2,
  },
  quickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    paddingHorizontal: ClearLensSpacing.sm,
    paddingVertical: 8,
    borderRadius: ClearLensRadii.sm,
  },
  quickLabel: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.slate,
    fontFamily: ClearLensFonts.medium,
    flex: 1,
  },
  syncBanner: {
    marginTop: 6,
    paddingHorizontal: ClearLensSpacing.sm,
    paddingVertical: 6,
    borderRadius: ClearLensRadii.sm,
    backgroundColor: ClearLensColors.mint50,
    borderWidth: 1,
    borderColor: ClearLensColors.mint,
  },
  syncBannerError: {
    backgroundColor: '#FEEDEE',
    borderColor: '#FCA5A5',
  },
  syncBannerText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.slate,
  },
  syncBannerTextError: {
    color: '#B91C1C',
  },
  spacer: {
    flex: 1,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    paddingHorizontal: ClearLensSpacing.sm,
    paddingVertical: ClearLensSpacing.sm,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.surfaceSoft,
  },
  accountBadge: {
    width: 34,
    height: 34,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.accountSurface,
    borderWidth: 1,
    borderColor: ClearLensColors.accountBorder,
  },
  accountInitial: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.slate,
    fontFamily: ClearLensFonts.bold,
  },
  accountText: {
    flex: 1,
    gap: 2,
  },
  accountName: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.navy,
    fontFamily: ClearLensFonts.semiBold,
  },
  accountAction: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
});
