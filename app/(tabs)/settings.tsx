import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useSession } from '@/src/hooks/useSession';
import { useInboundSession } from '@/src/hooks/useInboundSession';
import { useAppStore, BENCHMARK_OPTIONS } from '@/src/store/appStore';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';
import { useThemeVariant } from '@/src/hooks/useThemeVariant';

async function fetchProfile(userId: string) {
  const { data } = await supabase
    .from('user_profile')
    .select('pan, kfintech_email')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

function CopyRow({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={1} selectable>
          {value}
        </Text>
        {sublabel && <Text style={styles.rowSubLabel}>{sublabel}</Text>}
      </View>
      <TouchableOpacity onPress={handleCopy} style={[styles.actionBtn, copied && styles.actionBtnDone]}>
        <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={copied ? Colors.positive : Colors.primary} />
        <Text style={[styles.actionBtnText, copied && { color: Colors.positive }]}>
          {copied ? 'Copied' : 'Copy'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function maskPan(pan: string): string {
  if (pan.length !== 10) return pan;
  return pan.slice(0, 2) + '•'.repeat(6) + pan.slice(8);
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const theme = useThemeVariant();

  const {
    defaultBenchmarkSymbol,
    setDefaultBenchmarkSymbol,
    designVariant,
    setDesignVariant,
  } = useAppStore();
  const [benchmarkSaved, setBenchmarkSaved] = useState(false);
  const [variantSaved, setVariantSaved] = useState(false);

  type SyncState = 'idle' | 'syncing' | 'done' | 'error';
  const [syncState, setSyncState] = useState<SyncState>('idle');

  async function handleSync() {
    setSyncState('syncing');
    const [navResult, idxResult] = await Promise.allSettled([
      supabase.functions.invoke('sync-nav'),
      supabase.functions.invoke('sync-index'),
    ]);
    const navOk = navResult.status === 'fulfilled' && !navResult.value.error;
    const idxOk = idxResult.status === 'fulfilled' && !idxResult.value.error;
    if (navOk || idxOk) {
      // Invalidate the NAV badge so it re-fetches the new latest date.
      await queryClient.invalidateQueries({ queryKey: ['latest-nav-date'] });
      setSyncState('done');
      setTimeout(() => setSyncState('idle'), 3000);
    } else {
      setSyncState('error');
      setTimeout(() => setSyncState('idle'), 4000);
    }
  }

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });

  const { inboundEmail, isLoading: sessionLoading } = useInboundSession(userId);
  const isLoading = profileLoading || sessionLoading;

  const { data: latestNavRow } = useQuery({
    queryKey: ['latest-nav-date'],
    queryFn: async () => {
      const { data } = await supabase
        .from('nav_history')
        .select('nav_date')
        .order('nav_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.nav_date as string | null ?? null;
    },
    staleTime: 10 * 60 * 1000,
  });

  function navStatusBadge(navDate: string | null | undefined) {
    if (!navDate) return { color: Colors.textTertiary, dot: '#9ca3af', label: 'Unknown' };
    const today = new Date().toISOString().split('T')[0];
    const diffMs = new Date(today).getTime() - new Date(navDate).getTime();
    const diffDays = Math.round(diffMs / 86_400_000);
    const d = new Date(navDate);
    const dateLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (diffDays <= 1) return { color: Colors.positive, dot: Colors.positive, label: 'Live' };
    if (diffDays <= 3) return { color: '#d97706', dot: '#f59e0b', label: `Stale · ${dateLabel}` };
    return { color: Colors.negative, dot: Colors.negative, label: `Outdated · ${dateLabel}` };
  }

  const navBadge = navStatusBadge(latestNavRow);

  async function signOutNow() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error', error.message);
  }

  async function handleSignOut() {
    if (Platform.OS === 'web') {
      const confirmed = globalThis.confirm?.('Are you sure you want to sign out?') ?? true;
      if (confirmed) {
        await signOutNow();
      }
      return;
    }

    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOutNow();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, theme.isEditorial && styles.headerEditorial]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <Ionicons name="arrow-back" size={18} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Account ── */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <View style={styles.accountBadge}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={24} color={Colors.primary} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountEmail}>{session?.user.email ?? '—'}</Text>
              <Text style={styles.accountMeta}>
                {profile?.pan ? maskPan(profile.pan) : 'PAN not set'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/onboarding')} style={styles.editIconBtn}>
              <Ionicons name="pencil-outline" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {isLoading && (
            <View style={[styles.row, { justifyContent: 'center' }]}>
              <ActivityIndicator size="small" color={Colors.textTertiary} />
            </View>
          )}

          {!isLoading && profile?.kfintech_email && (
            <View style={[styles.row, styles.borderTop]}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>CAS registrar email</Text>
                <Text style={styles.rowValue} numberOfLines={1}>
                  {profile.kfintech_email}
                </Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/onboarding')} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Import ── */}
        {inboundEmail && (
          <>
            <SectionHeader title="Portfolio Import" />
            <View style={styles.card}>
              <CopyRow
                label="Your import address"
                value={inboundEmail}
                sublabel="Forward your CAMS CAS email here to auto-import"
              />
              <View style={[styles.row, styles.borderTop]}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowLabel}>Upload a CAS PDF</Text>
                  <Text style={styles.rowSubLabel}>Manually import from a downloaded PDF</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push('/onboarding/pdf')}
                  style={styles.actionBtn}
                >
                  <Ionicons name="cloud-upload-outline" size={14} color={Colors.primary} />
                  <Text style={styles.actionBtnText}>Upload</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* ── Data ── */}
        <SectionHeader title="Data" />
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>NAV data</Text>
              <Text style={styles.rowSubLabel}>Updated hourly on weekdays via AMFI</Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: navBadge.dot }]} />
              <Text style={[styles.statusText, { color: navBadge.color }]}>{navBadge.label}</Text>
            </View>
          </View>
          <View style={[styles.row, styles.borderTop]}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Manual sync</Text>
              <Text style={styles.rowSubLabel}>
                {syncState === 'done'
                  ? 'Sync complete — NAV and index data updated'
                  : syncState === 'error'
                    ? 'Sync failed — check your connection and try again'
                    : 'Fetch latest NAV and benchmark index data now'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleSync}
              disabled={syncState === 'syncing'}
              style={[
                styles.actionBtn,
                syncState === 'done' && styles.actionBtnDone,
                syncState === 'error' && styles.actionBtnError,
              ]}
              activeOpacity={0.75}
            >
              {syncState === 'syncing' ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons
                  name={syncState === 'done' ? 'checkmark' : syncState === 'error' ? 'alert-circle-outline' : 'refresh-outline'}
                  size={14}
                  color={syncState === 'done' ? Colors.positive : syncState === 'error' ? Colors.negative : Colors.primary}
                />
              )}
              <Text style={[
                styles.actionBtnText,
                syncState === 'done' && { color: Colors.positive },
                syncState === 'error' && { color: Colors.negative },
              ]}>
                {syncState === 'syncing' ? 'Syncing…' : syncState === 'done' ? 'Done' : syncState === 'error' ? 'Failed' : 'Sync now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Preferences ── */}
        <View style={styles.sectionHeaderRow}>
          <SectionHeader title="Preferences" />
          {benchmarkSaved && (
            <Text style={styles.savedFeedback}>✓ Saved</Text>
          )}
        </View>
        <View style={styles.card}>
          <View style={[styles.row, { flexDirection: 'column', alignItems: 'flex-start', paddingBottom: 6 }]}>
            <Text style={styles.rowLabel}>Default Benchmark</Text>
            <Text style={styles.rowSubLabel}>Used for &ldquo;You vs Market&rdquo; on the home screen</Text>
          </View>
          {BENCHMARK_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.symbol}
              style={[styles.row, styles.borderTop]}
              onPress={() => {
                setDefaultBenchmarkSymbol(opt.symbol);
                setBenchmarkSaved(true);
                setTimeout(() => setBenchmarkSaved(false), 1500);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowValue, { flex: 1 }]}>{opt.label}</Text>
              {defaultBenchmarkSymbol === opt.symbol && (
                <Ionicons name="checkmark" size={16} color={Colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeaderRow}>
          <SectionHeader title="Design Theme" />
          {variantSaved && <Text style={styles.savedFeedback}>✓ Saved</Text>}
        </View>
        <View style={styles.card}>
          <View style={[styles.row, { flexDirection: 'column', alignItems: 'flex-start', paddingBottom: 6 }]}>
            <Text style={styles.rowLabel}>App Appearance</Text>
            <Text style={styles.rowSubLabel}>Switch between the current and editorial design variants</Text>
          </View>
          <View style={styles.variantRow}>
            {(['classic', 'editorial'] as const).map((variant) => {
              const selected = designVariant === variant;
              return (
                <TouchableOpacity
                  key={variant}
                  style={[styles.variantPill, selected && styles.variantPillActive]}
                  onPress={() => {
                    setDesignVariant(variant);
                    setVariantSaved(true);
                    setTimeout(() => setVariantSaved(false), 1500);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.variantPillText, selected && styles.variantPillTextActive]}>
                    {variant === 'classic' ? 'Classic' : 'Editorial'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Account actions ── */}
        <SectionHeader title="Account Actions" />
        <View style={styles.card}>
          <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={Colors.negative} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerEditorial: {
    backgroundColor: '#f8f9fb',
  },
  backBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: Radii.full,
  },
  headerTitle: { ...Typography.h2, color: Colors.textPrimary },

  sectionHeader: {
    ...Typography.label,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    marginHorizontal: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: Spacing.md,
  },
  savedFeedback: {
    fontSize: 12,
    color: Colors.positive,
    fontWeight: '600',
    marginTop: Spacing.lg,
  },
  variantRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingBottom: 16,
    paddingTop: 8,
  },
  variantPill: {
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  variantPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  variantPillText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  variantPillTextActive: {
    color: '#fff',
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    marginHorizontal: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Account badge row
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: { flex: 1, gap: 2 },
  accountEmail: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  accountMeta: { fontSize: 12, color: Colors.textTertiary },
  editIconBtn: { padding: 6 },

  // Generic row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    gap: 12,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  rowLeft: { flex: 1, gap: 3 },
  rowLabel: { ...Typography.label, color: Colors.textTertiary, textTransform: 'uppercase' },
  rowValue: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  rowSubLabel: { ...Typography.bodySmall, color: Colors.textTertiary, marginTop: 1 },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radii.sm,
  },
  actionBtnDone: { backgroundColor: '#f0fdf4' },
  actionBtnError: { backgroundColor: '#fef2f2' },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  // Status badge
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.positive },
  statusText: { fontSize: 12, fontWeight: '600', color: Colors.positive },

  // Sign out
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 15,
  },
  signOutText: { color: Colors.negative, fontSize: 15, fontWeight: '600' },

  bottomPad: { height: 40 },
});
