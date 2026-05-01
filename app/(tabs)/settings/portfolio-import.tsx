import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useSession } from '@/src/hooks/useSession';
import { useInboundSession } from '@/src/hooks/useInboundSession';
import { UtilityHeader } from '@/src/components/UtilityHeader';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensShadow,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';

function formatImportDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

const IMPORT_TIPS = [
  { icon: 'mail-outline' as const, text: 'Use your registered email ID with CAMS.' },
  { icon: 'document-text-outline' as const, text: 'Include all pages in the PDF.' },
  { icon: 'time-outline' as const, text: 'Import usually completes in a few minutes.' },
];

export default function PortfolioImportScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const styles = useMemo(() => makeStyles(), []);
  const [copied, setCopied] = useState(false);

  const { inboundEmail } = useInboundSession(userId);

  const { data: lastImportDate } = useQuery({
    queryKey: ['last-cas-import', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('cas_import')
        .select('created_at')
        .eq('user_id', userId!)
        .eq('import_status', 'success')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.created_at as string | null ?? null;
    },
    enabled: !!userId,
  });

  async function handleCopy() {
    if (!inboundEmail) return;
    await Clipboard.setStringAsync(inboundEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const formattedLastImport = formatImportDate(lastImportDate);

  return (
    <SafeAreaView style={styles.container}>
      <UtilityHeader title="Portfolio import" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Auto-import */}
        {inboundEmail && (
          <>
            <Text style={styles.sectionLabel}>Auto-import (Email)</Text>
            <View style={styles.card}>
              <View style={styles.importAddressBlock}>
                <Text style={styles.rowLabel}>Your import address</Text>
                <View style={styles.importAddressRow}>
                  <Text style={styles.importAddress} numberOfLines={1} selectable>
                    {inboundEmail}
                  </Text>
                  <TouchableOpacity
                    style={[styles.copyBtn, copied && styles.copyBtnDone]}
                    onPress={handleCopy}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={copied ? 'checkmark' : 'copy-outline'}
                      size={14}
                      color={copied ? ClearLensColors.emerald : ClearLensColors.emerald}
                    />
                    <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.importAddressSub}>
                  Forward your CAS email here to auto-import
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Manual import */}
        <Text style={styles.sectionLabel}>Manual Import</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowValue}>Upload a CAS PDF</Text>
              <Text style={styles.rowSub}>Manually import from a downloaded PDF</Text>
            </View>
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => router.push('/onboarding/pdf')}
              activeOpacity={0.7}
            >
              <Ionicons name="cloud-upload-outline" size={14} color={ClearLensColors.emerald} />
              <Text style={styles.uploadBtnText}>Upload</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Import tips */}
        <Text style={styles.sectionLabel}>Import Tips</Text>
        <View style={styles.card}>
          {IMPORT_TIPS.map((tip, idx) => (
            <View key={idx} style={[styles.tipRow, idx > 0 && styles.borderTop]}>
              <View style={styles.tipIconWrap}>
                <Ionicons name={tip.icon} size={16} color={ClearLensColors.textTertiary} />
              </View>
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          ))}
        </View>

        {/* Last imported */}
        {formattedLastImport && (
          <View style={styles.lastImportCard}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowValue}>Last imported</Text>
              <Text style={styles.rowSub}>{formattedLastImport}</Text>
            </View>
          </View>
        )}
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

    importAddressBlock: {
      padding: ClearLensSpacing.md,
      gap: ClearLensSpacing.xs,
    },
    importAddressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ClearLensSpacing.sm,
    },
    importAddress: {
      ...ClearLensTypography.body,
      fontFamily: ClearLensFonts.semiBold,
      color: ClearLensColors.navy,
      flex: 1,
    },
    importAddressSub: {
      ...ClearLensTypography.bodySmall,
      color: ClearLensColors.textTertiary,
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: ClearLensColors.mint50,
      borderRadius: ClearLensRadii.full,
    },
    copyBtnDone: { backgroundColor: ClearLensColors.positiveBg },
    copyBtnText: {
      ...ClearLensTypography.caption,
      fontFamily: ClearLensFonts.semiBold,
      color: ClearLensColors.emerald,
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

    uploadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: ClearLensColors.mint50,
      borderRadius: ClearLensRadii.full,
    },
    uploadBtnText: {
      ...ClearLensTypography.caption,
      fontFamily: ClearLensFonts.semiBold,
      color: ClearLensColors.emerald,
    },

    tipRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: ClearLensSpacing.md,
      paddingVertical: 12,
      gap: ClearLensSpacing.sm,
    },
    tipIconWrap: { width: 22, alignItems: 'center', paddingTop: 1 },
    tipText: {
      ...ClearLensTypography.bodySmall,
      color: ClearLensColors.textSecondary,
      flex: 1,
    },

    lastImportCard: {
      backgroundColor: ClearLensColors.surface,
      borderRadius: ClearLensRadii.lg,
      borderWidth: 1,
      borderColor: ClearLensColors.border,
      paddingHorizontal: ClearLensSpacing.md,
      paddingVertical: 14,
      ...ClearLensShadow,
    },
  });
}
