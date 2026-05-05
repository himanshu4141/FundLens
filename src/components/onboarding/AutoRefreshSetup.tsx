import { useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useClearLensTokens } from '@/src/context/ThemeContext';
import {
  ClearLensFonts,
  ClearLensRadii,
  ClearLensShadow,
  ClearLensSpacing,
  ClearLensTypography,
  type ClearLensTokens,
} from '@/src/constants/clearLensTheme';
import { formatInboxAddress } from '@/src/utils/casInboxToken';

/**
 * Shared body of the "Set up auto-refresh" UI. Used by:
 *
 *   - The wizard's Step 3 sub-screen (opened from the third import card).
 *   - Settings → Account → Auto-refresh row (deep-linked on tap).
 *
 * Owns no remote state — the parent passes the user's inbox token,
 * the optional pending Gmail confirmation URL, and a callback to
 * invoke after the user clicks the confirmation link (so the parent
 * can refetch user_profile).
 *
 * The hybrid-flow (M2.0 decision):
 *
 *   - Manual forward is the universal default. Works on every client.
 *   - Auto-forward is an opt-in expander with platform tabs:
 *       Gmail   — surface confirmationUrl when captured
 *       Outlook — direct rule instructions, no verification step
 *       iCloud / Yahoo — explicitly not supported
 *       Other  — generic guidance
 */

type ClientTab = 'gmail' | 'outlook' | 'other';

const GMAIL_FILTER_URL = 'https://mail.google.com/mail/u/0/#settings/filters';
const OUTLOOK_RULES_URL = 'https://outlook.live.com/mail/0/options/mail/rules';

interface Props {
  inboxToken: string;
  /** Captured by the Edge Function when Gmail emails the verification link. */
  pendingConfirmationUrl?: string | null;
  /** Called after the user taps the "Confirm Gmail forwarding" CTA so the parent can refetch. */
  onConfirmClicked?: () => void;
}

export function AutoRefreshSetup({
  inboxToken,
  pendingConfirmationUrl,
  onConfirmClicked,
}: Props) {
  const tokens = useClearLensTokens();
  const cl = tokens.colors;
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const inboxAddress = useMemo(() => formatInboxAddress(inboxToken), [inboxToken]);
  const [copied, setCopied] = useState(false);
  const [autoForwardOpen, setAutoForwardOpen] = useState(false);
  const [tab, setTab] = useState<ClientTab>('gmail');

  async function handleCopy() {
    await Clipboard.setStringAsync(inboxAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function openExternal(url: string) {
    try {
      if (Platform.OS === 'web') {
        await Linking.openURL(url);
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
    } catch {
      // best-effort; clipboard already has the address either way
    }
  }

  async function handleConfirmGmail() {
    if (!pendingConfirmationUrl) return;
    await openExternal(pendingConfirmationUrl);
    onConfirmClicked?.();
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Set up auto-refresh</Text>
        <Text style={styles.subtitle}>
          Forward CAS emails from CAMS / KFintech to your private FolioLens
          address and your portfolio updates automatically — no re-uploading.
        </Text>
      </View>

      <View style={styles.addressCard}>
        <Text style={styles.addressLabel}>Your private import address</Text>
        <View style={styles.addressRow}>
          <Text style={[styles.addressValue, styles.mono]} numberOfLines={2} selectable>
            {inboxAddress}
          </Text>
          <TouchableOpacity
            style={[styles.copyBtn, copied && styles.copyBtnActive]}
            onPress={handleCopy}
            activeOpacity={0.8}
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={14}
              color={cl.emeraldDeep}
            />
            <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.addressHint}>
          Treat this like a password — anyone who knows it can send PDFs to your
          import inbox. We sign every webhook so unsolicited mail without a CAS
          attachment is silently dropped.
        </Text>
      </View>

      {pendingConfirmationUrl ? (
        <View style={styles.confirmBanner}>
          <View style={styles.confirmIconWrap}>
            <Ionicons name="alert-circle" size={20} color={cl.emeraldDeep} />
          </View>
          <View style={styles.confirmCopy}>
            <Text style={styles.confirmTitle}>Confirm Gmail forwarding</Text>
            <Text style={styles.confirmBody}>
              Google emailed a verification link to your import address. Click
              the button to finish setting up auto-forward — you only need to
              do this once.
            </Text>
            <TouchableOpacity
              style={styles.confirmCta}
              onPress={handleConfirmGmail}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmCtaText}>Open verification link</Text>
              <Ionicons name="open-outline" size={14} color={cl.textOnDark} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.manualCard}>
        <View style={styles.manualHeader}>
          <View style={styles.manualBadge}>
            <Text style={styles.manualBadgeText}>RECOMMENDED</Text>
          </View>
          <Text style={styles.manualTitle}>Forward each CAS email manually</Text>
        </View>
        <Text style={styles.manualBody}>
          Each time CAMS or KFintech emails you a Consolidated Account Statement
          (~once a month), open the email and tap Forward → paste the address
          above → send. Works on every email client without any setup.
        </Text>
      </View>

      <Pressable
        style={styles.expander}
        onPress={() => setAutoForwardOpen((v) => !v)}
        accessibilityRole="button"
      >
        <Ionicons
          name={autoForwardOpen ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={cl.emeraldDeep}
        />
        <Text style={styles.expanderText}>
          Or set up auto-forward (advanced)
        </Text>
      </Pressable>

      {autoForwardOpen ? (
        <View style={styles.advancedCard}>
          <View style={styles.tabRow}>
            <TabButton label="Gmail" active={tab === 'gmail'} onPress={() => setTab('gmail')} styles={styles} />
            <TabButton label="Outlook" active={tab === 'outlook'} onPress={() => setTab('outlook')} styles={styles} />
            <TabButton label="Other" active={tab === 'other'} onPress={() => setTab('other')} styles={styles} />
          </View>

          {tab === 'gmail' ? (
            <View style={styles.tabBody}>
              <Step n={1} text="Open Gmail Settings → Forwarding and POP/IMAP." styles={styles} />
              <Step
                n={2}
                text="Click 'Add a forwarding address' and paste the address above. Save."
                styles={styles}
              />
              <Step
                n={3}
                text="Google will email a verification link to that address. We'll capture it and surface a 'Confirm' button right above this card within ~30 seconds — come back to this screen and tap it once."
                styles={styles}
              />
              <Step
                n={4}
                text="Back in Gmail, create a filter from CAMS / KFintech with the action 'Forward to' → your new FolioLens address."
                styles={styles}
              />
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => openExternal(GMAIL_FILTER_URL)}
                activeOpacity={0.7}
              >
                <Ionicons name="open-outline" size={14} color={cl.emeraldDeep} />
                <Text style={styles.linkText}>Open Gmail filter settings</Text>
              </TouchableOpacity>
              <Text style={styles.tabFooter}>
                Gmail Workspace users: an admin may have to allowlist external
                forwarding for your domain.
              </Text>
            </View>
          ) : null}

          {tab === 'outlook' ? (
            <View style={styles.tabBody}>
              <Step n={1} text="Open Outlook Settings → Mail → Rules → 'Add new rule'." styles={styles} />
              <Step
                n={2}
                text="Condition: From contains 'donotreply@camsonline.com' OR 'donotreply@kfintech.com'."
                styles={styles}
              />
              <Step
                n={3}
                text="Action: 'Forward to' → your FolioLens address. Save."
                styles={styles}
              />
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => openExternal(OUTLOOK_RULES_URL)}
                activeOpacity={0.7}
              >
                <Ionicons name="open-outline" size={14} color={cl.emeraldDeep} />
                <Text style={styles.linkText}>Open Outlook rules</Text>
              </TouchableOpacity>
              <Text style={styles.tabFooter}>
                Outlook applies the rule immediately — no destination
                verification. Microsoft 365 (work) accounts behave the same
                unless your tenant blocks external forwarding.
              </Text>
            </View>
          ) : null}

          {tab === 'other' ? (
            <View style={styles.tabBody}>
              <Text style={styles.tabBodyText}>
                <Text style={styles.bold}>iCloud Mail</Text> and{' '}
                <Text style={styles.bold}>Yahoo Mail (free)</Text> can&apos;t
                auto-forward only the CAS emails — please use manual forward
                instead.
              </Text>
              <Text style={styles.tabBodyText}>
                For other clients, look for a Filters / Rules / Server-side
                forwarding option. If your client requires verifying the
                destination, we capture the verification email and surface a
                &quot;Confirm&quot; button above this card the same way we do
                for Gmail.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function TabButton({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Step({
  n,
  text,
  styles,
}: {
  n: number;
  text: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNumWrap}>
        <Text style={styles.stepNum}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function makeStyles(tokens: ClearLensTokens) {
  const cl = tokens.colors;
  return StyleSheet.create({
    container: {
      paddingHorizontal: ClearLensSpacing.md,
      paddingBottom: ClearLensSpacing.xxl,
      gap: ClearLensSpacing.md,
    },
    header: {
      gap: 6,
      paddingTop: ClearLensSpacing.sm,
    },
    title: {
      ...ClearLensTypography.h1,
      color: cl.navy,
    },
    subtitle: {
      ...ClearLensTypography.bodySmall,
      color: cl.textSecondary,
    },
    addressCard: {
      backgroundColor: cl.surface,
      borderRadius: ClearLensRadii.lg,
      borderWidth: 1,
      borderColor: cl.border,
      padding: ClearLensSpacing.md,
      gap: 8,
      ...ClearLensShadow,
    },
    addressLabel: {
      ...ClearLensTypography.caption,
      color: cl.textTertiary,
      fontFamily: ClearLensFonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ClearLensSpacing.sm,
    },
    addressValue: {
      flex: 1,
      fontSize: 14,
      color: cl.navy,
    },
    mono: { fontFamily: 'Courier' },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: cl.mint50,
      borderRadius: ClearLensRadii.full,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    copyBtnActive: {
      backgroundColor: cl.positiveBg,
    },
    copyBtnText: {
      fontSize: 12,
      fontFamily: ClearLensFonts.bold,
      color: cl.emeraldDeep,
    },
    addressHint: {
      ...ClearLensTypography.caption,
      color: cl.textTertiary,
      lineHeight: 16,
    },
    confirmBanner: {
      flexDirection: 'row',
      gap: ClearLensSpacing.sm,
      backgroundColor: cl.positiveBg,
      borderWidth: 1,
      borderColor: cl.mint,
      borderRadius: ClearLensRadii.lg,
      padding: ClearLensSpacing.md,
    },
    confirmIconWrap: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmCopy: {
      flex: 1,
      gap: 6,
    },
    confirmTitle: {
      ...ClearLensTypography.body,
      color: cl.navy,
      fontFamily: ClearLensFonts.bold,
    },
    confirmBody: {
      ...ClearLensTypography.bodySmall,
      color: cl.textSecondary,
      lineHeight: 18,
    },
    confirmCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: cl.emeraldDeep,
      borderRadius: ClearLensRadii.full,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginTop: 4,
    },
    confirmCtaText: {
      ...ClearLensTypography.bodySmall,
      color: cl.textOnDark,
      fontFamily: ClearLensFonts.bold,
    },
    manualCard: {
      backgroundColor: cl.surface,
      borderRadius: ClearLensRadii.lg,
      borderWidth: 1,
      borderColor: cl.border,
      padding: ClearLensSpacing.md,
      gap: ClearLensSpacing.sm,
      ...ClearLensShadow,
    },
    manualHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ClearLensSpacing.sm,
      flexWrap: 'wrap',
    },
    manualBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: ClearLensRadii.sm,
      backgroundColor: cl.mint50,
    },
    manualBadgeText: {
      fontSize: 9,
      fontFamily: ClearLensFonts.bold,
      color: cl.emeraldDeep,
      letterSpacing: 0.4,
    },
    manualTitle: {
      ...ClearLensTypography.body,
      color: cl.navy,
      fontFamily: ClearLensFonts.bold,
    },
    manualBody: {
      ...ClearLensTypography.bodySmall,
      color: cl.textSecondary,
      lineHeight: 18,
    },
    expander: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
    },
    expanderText: {
      ...ClearLensTypography.bodySmall,
      color: cl.emeraldDeep,
      fontFamily: ClearLensFonts.bold,
    },
    advancedCard: {
      backgroundColor: cl.surfaceSoft,
      borderRadius: ClearLensRadii.lg,
      padding: ClearLensSpacing.md,
      gap: ClearLensSpacing.md,
    },
    tabRow: {
      flexDirection: 'row',
      gap: 6,
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: ClearLensRadii.full,
      backgroundColor: cl.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: cl.border,
    },
    tabActive: {
      backgroundColor: cl.emeraldDeep,
      borderColor: cl.emeraldDeep,
    },
    tabText: {
      ...ClearLensTypography.caption,
      color: cl.textSecondary,
      fontFamily: ClearLensFonts.bold,
    },
    tabTextActive: {
      color: cl.textOnDark,
    },
    tabBody: {
      gap: ClearLensSpacing.sm,
    },
    tabBodyText: {
      ...ClearLensTypography.bodySmall,
      color: cl.textSecondary,
      lineHeight: 18,
    },
    bold: {
      fontFamily: ClearLensFonts.bold,
      color: cl.navy,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: ClearLensSpacing.sm,
    },
    stepNumWrap: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: cl.mint50,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    stepNum: {
      fontSize: 11,
      fontFamily: ClearLensFonts.bold,
      color: cl.emeraldDeep,
    },
    stepText: {
      flex: 1,
      ...ClearLensTypography.bodySmall,
      color: cl.textSecondary,
      lineHeight: 18,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
    },
    linkText: {
      ...ClearLensTypography.bodySmall,
      color: cl.emeraldDeep,
      fontFamily: ClearLensFonts.bold,
    },
    tabFooter: {
      ...ClearLensTypography.caption,
      color: cl.textTertiary,
      lineHeight: 16,
      marginTop: 4,
    },
  });
}
