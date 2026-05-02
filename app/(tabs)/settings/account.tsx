import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useSession } from '@/src/hooks/useSession';
import { UtilityHeader } from '@/src/components/UtilityHeader';
import { GoogleIcon } from '@/src/components/GoogleIcon';
import { getNativeAuthOrigin, getNativeBridgeUrl } from '@/src/utils/appScheme';
import { parseOAuthCode } from '@/src/utils/authUtils';
import { maskPan } from './index';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensShadow,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';

async function fetchProfile(userId: string) {
  const { data } = await supabase
    .from('user_profile')
    .select('pan, kfintech_email, dob')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

function formatDob(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

export default function AccountScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const styles = useMemo(() => makeStyles(), []);

  const identities = session?.user?.identities ?? [];
  const isGoogleLinked = identities.some((id: { provider: string }) => id.provider === 'google');
  const googleIdentity = identities.find((id: { provider: string }) => id.provider === 'google');

  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });

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

    if (error) { setLinkError(error.message); setLinkingGoogle(false); return; }

    if (Platform.OS === 'web') {
      if (data?.url) window.location.href = data.url;
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, getNativeAuthOrigin());
    setLinkingGoogle(false);

    if (result.type === 'success') {
      const code = parseOAuthCode(result.url);
      if (code) {
        router.push(`/auth/callback?code=${encodeURIComponent(code)}&callbackUrl=${encodeURIComponent(result.url)}`);
      }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <UtilityHeader title="Account" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Profile */}
        <Text style={styles.sectionLabel}>Profile</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.profileRow}
            onPress={() => router.push('/onboarding')}
            activeOpacity={0.7}
          >
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={22} color={ClearLensColors.emerald} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileEmail} numberOfLines={1}>{session?.user.email ?? '—'}</Text>
              <Text style={styles.profileMeta}>
                {isLoading ? 'Loading…' : profile?.pan ? maskPan(profile.pan) : 'PAN not set'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={ClearLensColors.textTertiary} />
          </TouchableOpacity>

          {!isLoading && profile?.kfintech_email && (
            <View style={[styles.row, styles.borderTop]}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>CAS Registrar Email</Text>
                <Text style={styles.rowValue} numberOfLines={1}>{profile.kfintech_email}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/onboarding')} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isLoading && (
            <View style={[styles.row, styles.borderTop]}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>Date of Birth</Text>
                <Text style={styles.rowValue}>
                  {profile?.dob ? formatDob(profile.dob) : 'Not set'}
                </Text>
                {!profile?.dob && (
                  <Text style={styles.rowSub}>
                    Required for CDSL/NSDL CAS imports
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => router.push('/onboarding')} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>{profile?.dob ? 'Edit' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Connected accounts */}
        <Text style={styles.sectionLabel}>Connected Accounts</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.providerIconWrap}>
              <Ionicons name="mail-outline" size={18} color={ClearLensColors.textSecondary} />
            </View>
            <View style={styles.rowLeft}>
              <Text style={styles.rowValue}>Email (magic link)</Text>
              <Text style={styles.rowSub} numberOfLines={1}>{session?.user.email}</Text>
            </View>
            <View style={styles.connectedBadge}>
              <Text style={styles.connectedText}>Connected</Text>
            </View>
          </View>

          <View style={[styles.row, styles.borderTop]}>
            <View style={styles.providerIconWrap}><GoogleIcon size={18} /></View>
            <View style={styles.rowLeft}>
              <Text style={styles.rowValue}>Google</Text>
              {isGoogleLinked && (googleIdentity?.identity_data?.['email'] as string | undefined) ? (
                <Text style={styles.rowSub} numberOfLines={1}>
                  {googleIdentity?.identity_data?.['email'] as string}
                </Text>
              ) : null}
            </View>
            {isGoogleLinked ? (
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedText}>Connected</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, linkingGoogle && { opacity: 0.6 }]}
                onPress={handleLinkGoogle}
                disabled={linkingGoogle}
                activeOpacity={0.75}
              >
                {linkingGoogle
                  ? <ActivityIndicator size="small" color={ClearLensColors.emerald} />
                  : <Text style={styles.actionBtnText}>Connect</Text>}
              </TouchableOpacity>
            )}
          </View>

          {linkError && (
            <View style={[styles.row, styles.borderTop]}>
              <Text style={[styles.rowSub, { color: ClearLensColors.negative, flex: 1 }]}>
                {linkError}
              </Text>
            </View>
          )}
        </View>

        {/* Footer note */}
        <View style={styles.footerNote}>
          <Ionicons name="shield-checkmark-outline" size={15} color={ClearLensColors.textTertiary} />
          <Text style={styles.footerNoteText}>
            These accounts are used to sign in to FundLens.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: ClearLensColors.background },
    content: { padding: ClearLensSpacing.md, gap: ClearLensSpacing.sm, paddingBottom: ClearLensSpacing.xxl },

    sectionLabel: {
      ...ClearLensTypography.label,
      color: ClearLensColors.textTertiary,
      textTransform: 'uppercase',
      marginBottom: ClearLensSpacing.xs,
      marginTop: ClearLensSpacing.xs,
    },

    card: {
      backgroundColor: ClearLensColors.surface,
      borderRadius: ClearLensRadii.lg,
      borderWidth: 1,
      borderColor: ClearLensColors.border,
      overflow: 'hidden',
      ...ClearLensShadow,
    },

    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: ClearLensSpacing.md,
      gap: ClearLensSpacing.md,
    },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: ClearLensRadii.full,
      backgroundColor: ClearLensColors.mint50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileInfo: { flex: 1, gap: 3 },
    profileEmail: {
      ...ClearLensTypography.h3,
      fontFamily: ClearLensFonts.semiBold,
      color: ClearLensColors.navy,
    },
    profileMeta: {
      ...ClearLensTypography.bodySmall,
      color: ClearLensColors.textTertiary,
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
    rowLabel: {
      ...ClearLensTypography.label,
      color: ClearLensColors.textTertiary,
      textTransform: 'uppercase',
    },
    rowValue: {
      ...ClearLensTypography.h3,
      color: ClearLensColors.navy,
    },
    rowSub: {
      ...ClearLensTypography.bodySmall,
      color: ClearLensColors.textTertiary,
    },

    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: ClearLensColors.mint50,
      borderRadius: ClearLensRadii.full,
    },
    actionBtnText: {
      ...ClearLensTypography.caption,
      fontFamily: ClearLensFonts.semiBold,
      color: ClearLensColors.emerald,
    },

    providerIconWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

    connectedBadge: {
      backgroundColor: ClearLensColors.positiveBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: ClearLensRadii.full,
    },
    connectedText: {
      ...ClearLensTypography.caption,
      fontFamily: ClearLensFonts.semiBold,
      color: ClearLensColors.emerald,
    },

    footerNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: ClearLensSpacing.xs,
      paddingHorizontal: ClearLensSpacing.xs,
      marginTop: ClearLensSpacing.xs,
    },
    footerNoteText: {
      ...ClearLensTypography.bodySmall,
      color: ClearLensColors.textTertiary,
      flex: 1,
    },
  });
}
