import { useState, useMemo } from 'react';
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
import * as WebBrowser from 'expo-web-browser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useSession } from '@/src/hooks/useSession';
import { useInboundSession } from '@/src/hooks/useInboundSession';
import { useAppStore, BENCHMARK_OPTIONS } from '@/src/store/appStore';
import { Spacing, Radii, Typography } from '@/src/constants/theme';
import { useTheme } from '@/src/context/ThemeContext';
import { GoogleIcon } from '@/src/components/GoogleIcon';
import { UtilityHeader } from '@/src/components/UtilityHeader';
import { getNativeAuthOrigin, getNativeBridgeUrl } from '@/src/utils/appScheme';
import { parseOAuthCode } from '@/src/utils/authUtils';
import type { AppColors } from '@/src/context/ThemeContext';

async function fetchProfile(userId: string) {
  const { data } = await supabase
    .from('user_profile')
    .select('pan, kfintech_email')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

function CopyRow({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
        <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={copied ? colors.positive : colors.primary} />
        <Text style={[styles.actionBtnText, copied && { color: colors.positive }]}>
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { defaultBenchmarkSymbol, setDefaultBenchmarkSymbol, appDesignMode, setAppDesignMode } = useAppStore();
  const [benchmarkSaved, setBenchmarkSaved] = useState(false);

  // ── Connected accounts ────────────────────────────────────────────────────
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const identities = session?.user?.identities ?? [];
  const isGoogleLinked = identities.some((id: { provider: string }) => id.provider === 'google');
  const googleIdentity = identities.find((id: { provider: string }) => id.provider === 'google');

  async function handleLinkGoogle() {
    setLinkError(null);
    setLinkingGoogle(true);

    const redirectTo = Platform.OS === 'web'
      ? `${window.location.origin}/auth/callback`
      : getNativeBridgeUrl('/auth/callback');

    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
    });

    if (error) {
      setLinkError(error.message);
      setLinkingGoogle(false);
      return;
    }

    if (Platform.OS === 'web') {
      if (data?.url) window.location.href = data.url;
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, getNativeAuthOrigin());
    setLinkingGoogle(false);

    if (result.type === 'success') {
      const code = parseOAuthCode(result.url);
      if (code) {
        router.push(
          `/auth/callback?code=${encodeURIComponent(code)}&callbackUrl=${encodeURIComponent(result.url)}`,
        );
      }
    }
  }

  type SyncState = 'idle' | 'syncing' | 'done' | 'error';
  const [syncState, setSyncState] = useState<SyncState>('idle');

  async function handleSync() {
    setSyncState('syncing');
    // Portfolio composition and fund meta have staleness guards — they return
    // fast when data is fresh and are covered by their own crons. Fire them in
    // the background so they don't block the button response.
    supabase.functions.invoke('sync-fund-portfolios').catch(() => {});
    supabase.functions.invoke('sync-fund-meta').catch(() => {});
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
    if (!navDate) return { color: colors.textTertiary, dot: '#9ca3af', label: 'Unknown' };
    const today = new Date().toISOString().split('T')[0];
    const diffMs = new Date(today).getTime() - new Date(navDate).getTime();
    const diffDays = Math.round(diffMs / 86_400_000);
    const d = new Date(navDate);
    const dateLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (diffDays <= 1) return { color: colors.positive, dot: colors.positive, label: 'Live' };
    if (diffDays <= 3) return { color: '#d97706', dot: '#f59e0b', label: `Stale · ${dateLabel}` };
    return { color: colors.negative, dot: colors.negative, label: `Outdated · ${dateLabel}` };
  }

  const navBadge = navStatusBadge(latestNavRow);

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert('Error', error.message);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <UtilityHeader title="Settings" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Account ── */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <View style={styles.accountBadge}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={24} color={colors.primary} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountEmail}>{session?.user.email ?? '—'}</Text>
              <Text style={styles.accountMeta}>
                {profile?.pan ? maskPan(profile.pan) : 'PAN not set'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/onboarding')} style={styles.editIconBtn}>
              <Ionicons name="pencil-outline" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {isLoading && (
            <View style={[styles.row, { justifyContent: 'center' }]}>
              <ActivityIndicator size="small" color={colors.textTertiary} />
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

        {/* ── Connected Accounts ── */}
        <SectionHeader title="Connected Accounts" />
        <View style={styles.card}>
          {/* Email / magic link — always present */}
          <View style={styles.row}>
            <View style={styles.providerIconWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
            </View>
            <View style={styles.rowLeft}>
              <Text style={styles.rowValue}>Email (magic link)</Text>
              <Text style={styles.rowSubLabel}>{session?.user.email}</Text>
            </View>
            <View style={[styles.statusBadge, styles.connectedBadge]}>
              <Text style={[styles.statusText, { color: colors.positive }]}>Connected</Text>
            </View>
          </View>

          {/* Google */}
          <View style={[styles.row, styles.borderTop]}>
            <View style={styles.providerIconWrap}>
              <GoogleIcon size={18} />
            </View>
            <View style={styles.rowLeft}>
              <Text style={styles.rowValue}>Google</Text>
              {isGoogleLinked && (googleIdentity?.identity_data?.['email'] as string | undefined) ? (
                <Text style={styles.rowSubLabel}>
                  {googleIdentity?.identity_data?.['email'] as string}
                </Text>
              ) : null}
            </View>
            {isGoogleLinked ? (
              <View style={[styles.statusBadge, styles.connectedBadge]}>
                <Text style={[styles.statusText, { color: colors.positive }]}>Connected</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, linkingGoogle && { opacity: 0.6 }]}
                onPress={handleLinkGoogle}
                disabled={linkingGoogle}
                activeOpacity={0.75}
              >
                {linkingGoogle
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={styles.actionBtnText}>Connect</Text>
                }
              </TouchableOpacity>
            )}
          </View>

          {linkError && (
            <View style={[styles.row, styles.borderTop]}>
              <Text style={[styles.rowSubLabel, { color: colors.negative, flex: 1 }]}>
                {linkError}
              </Text>
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
                  <Ionicons name="cloud-upload-outline" size={14} color={colors.primary} />
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
                    : 'Fetch latest NAV, index, portfolio composition, and fund metadata'}
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
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons
                  name={syncState === 'done' ? 'checkmark' : syncState === 'error' ? 'alert-circle-outline' : 'refresh-outline'}
                  size={14}
                  color={syncState === 'done' ? colors.positive : syncState === 'error' ? colors.negative : colors.primary}
                />
              )}
              <Text style={[
                styles.actionBtnText,
                syncState === 'done' && { color: colors.positive },
                syncState === 'error' && { color: colors.negative },
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
                <Ionicons name="checkmark" size={16} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── App Design ── */}
        <SectionHeader title="App Design" />
        <View style={styles.card}>
          {([
            { value: 'classic' as const, label: 'Current design' },
            { value: 'clearLens' as const, label: 'New Clear Lens design' },
          ]).map((option, idx) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.row, idx > 0 && styles.borderTop]}
              onPress={() => setAppDesignMode(option.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowValue, { flex: 1 }]}>
                {option.label}
              </Text>
              <Ionicons
                name={appDesignMode === option.value ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={appDesignMode === option.value ? colors.primary : colors.textTertiary}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Account actions ── */}
        <SectionHeader title="Account Actions" />
        <View style={styles.card}>
          <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={colors.negative} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    sectionHeader: {
      ...Typography.label,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      marginTop: Spacing.lg,
      marginBottom: Spacing.md,
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
      color: colors.positive,
      fontWeight: '600',
      marginTop: Spacing.lg,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: Radii.lg,
      marginHorizontal: Spacing.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountInfo: { flex: 1, gap: 2 },
    accountEmail: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    accountMeta: { fontSize: 12, color: colors.textTertiary },
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
      borderTopColor: colors.borderLight,
    },
    rowLeft: { flex: 1, gap: 3 },
    rowLabel: { ...Typography.label, color: colors.textTertiary, textTransform: 'uppercase' },
    rowValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    rowSubLabel: { ...Typography.bodySmall, color: colors.textTertiary, marginTop: 1 },

    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.primaryLight,
      borderRadius: Radii.sm,
    },
    actionBtnDone: { backgroundColor: '#f0fdf4' },
    actionBtnError: { backgroundColor: '#fef2f2' },
    actionBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },

    // Provider icon wrapper
    providerIconWrap: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    connectedBadge: {
      backgroundColor: '#f0fdf4',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: Radii.sm,
    },

    // Status badge
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.positive },
    statusText: { fontSize: 12, fontWeight: '600', color: colors.positive },

    // Sign out
    signOutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: Spacing.md,
      paddingVertical: 15,
    },
    signOutText: { color: colors.negative, fontSize: 15, fontWeight: '600' },

    bottomPad: { height: 40 },
  });
}
