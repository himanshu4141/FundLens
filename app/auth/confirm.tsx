import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Logo from '@/src/components/Logo';
import { FolioLensLogo } from '@/src/components/clearLens/FolioLensLogo';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import { useResponsiveLayout } from '@/src/components/responsive';
import { getAppScheme } from '@/src/utils/appScheme';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';

const CL_TIPS = [
  { icon: 'time-outline' as const,           text: 'The link expires in 10 minutes.' },
  { icon: 'mail-outline' as const,           text: 'Check your spam folder if you don\'t see it.' },
  { icon: 'phone-portrait-outline' as const, text: 'Open the link on this device for the best experience.' },
];

export default function ConfirmScreen() {
  const router = useRouter();
  const { isClearLens } = useAppDesignMode();
  const { layout } = useResponsiveLayout();
  const isDesktop = layout === 'desktop';
  const { scheme, email } = useLocalSearchParams<{ scheme?: string; email?: string }>();
  const targetScheme = typeof scheme === 'string' && scheme.length > 0 ? scheme : getAppScheme();
  const displayEmail = typeof email === 'string' && email.length > 0 ? email : null;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const nativeBridgeHostname = new URL(process.env.EXPO_PUBLIC_APP_BASE_URL ?? 'https://app.foliolens.in').hostname;
    const isNativeBridgeHost = window.location.hostname === nativeBridgeHostname;
    if (!/iphone|ipad|ipod|android/.test(ua) || !isNativeBridgeHost) return;

    window.location.replace(`${targetScheme}://auth/confirm${hash}`);
  }, [targetScheme]);

  async function handleResend() {
    router.replace('/auth');
  }

  // ── ClearLens design ──
  if (isClearLens) {
    return (
      <View style={clStyles.container}>
        {/* Logo bar */}
        <View style={clStyles.logoBar}>
          <FolioLensLogo size={30} showWordmark />
        </View>

        <ScrollView
          contentContainerStyle={[clStyles.scrollContent, isDesktop && clStyles.scrollContentDesktop]}
          showsVerticalScrollIndicator={false}
        >
          {/* Envelope illustration */}
          <View style={clStyles.illustrationWrap}>
            <View style={clStyles.envelope}>
              <View style={clStyles.envelopeFlap} />
              <View style={clStyles.envelopeBody}>
                <View style={clStyles.envelopeLine} />
                <View style={[clStyles.envelopeLine, clStyles.envelopeLineShort]} />
              </View>
              <View style={clStyles.badge}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            </View>
          </View>

          <Text style={clStyles.title}>Check your inbox</Text>

          <Text style={clStyles.body}>
            We sent a secure sign-in link to{'\n'}
            {displayEmail ? (
              <Text style={clStyles.emailHighlight}>{displayEmail}</Text>
            ) : (
              'your email address'
            )}
          </Text>

          {/* Tips card */}
          <View style={clStyles.tipsCard}>
            <Text style={clStyles.tipsLabel}>Good to know</Text>
            {CL_TIPS.map(({ icon, text }) => (
              <View key={text} style={clStyles.tipRow}>
                <Ionicons name={icon} size={15} color={ClearLensColors.emerald} />
                <Text style={clStyles.tipText}>{text}</Text>
              </View>
            ))}
          </View>

          <View style={clStyles.actions}>
            <TouchableOpacity
              style={clStyles.secondaryBtn}
              onPress={handleResend}
              activeOpacity={0.75}
            >
              <Text style={clStyles.secondaryBtnText}>Use a different email</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Classic design ──
  return (
    <View style={styles.container}>
      {/* Logo at top */}
      <View style={styles.logoArea}>
        <Logo size={44} showWordmark />
      </View>

      {/* Envelope illustration */}
      <View style={styles.illustrationWrap}>
        <View style={styles.envelope}>
          <View style={styles.envelopeFlap} />
          <View style={styles.envelopeBody}>
            <View style={styles.envelopeLine} />
            <View style={[styles.envelopeLine, styles.envelopeLineShort]} />
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓</Text>
          </View>
        </View>
      </View>

      <Text style={styles.title}>Check your inbox</Text>

      <Text style={styles.body}>
        We sent a secure sign-in link to your email. Tap it to open FolioLens — no
        password needed.
      </Text>

      <View style={styles.tips}>
        <Text style={styles.tipText}>⏱ The link expires in 10 minutes.</Text>
        <Text style={styles.tipText}>📂 Check your spam folder if you don&apos;t see it.</Text>
        <Text style={styles.tipText}>📱 Open the link on this device for the smoothest experience.</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleResend}
          activeOpacity={0.75}
        >
          <Text style={styles.secondaryBtnText}>Use a different email</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Classic styles ──
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },

  logoArea: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 48,
    left: Spacing.lg,
  },

  illustrationWrap: {
    marginBottom: Spacing.sm,
  },
  envelope: {
    width: 80,
    height: 60,
    position: 'relative',
  },
  envelopeFlap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 32,
    backgroundColor: Colors.primaryLight,
    borderTopLeftRadius: Radii.sm,
    borderTopRightRadius: Radii.sm,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: Colors.primary + '55',
  },
  envelopeBody: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Colors.primary + '55',
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  envelopeLine: {
    height: 3,
    width: 40,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  envelopeLineShort: {
    width: 28,
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.positive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  tips: {
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    width: '100%',
  },
  tipText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  actions: {
    marginTop: Spacing.sm,
    width: '100%',
    alignItems: 'center',
    gap: Spacing.md,
  },
  secondaryBtn: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});

// ── ClearLens styles ──
const clStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ClearLensColors.background,
  },
  logoBar: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: ClearLensSpacing.lg,
    paddingBottom: ClearLensSpacing.sm,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: ClearLensSpacing.lg,
    paddingTop: ClearLensSpacing.xl,
    paddingBottom: ClearLensSpacing.xxl,
    gap: ClearLensSpacing.md,
  },
  scrollContentDesktop: {
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  } as never,

  illustrationWrap: {
    marginBottom: ClearLensSpacing.sm,
  },
  envelope: {
    width: 96,
    height: 72,
    position: 'relative',
  },
  envelopeFlap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 38,
    backgroundColor: ClearLensColors.mint50,
    borderTopLeftRadius: ClearLensRadii.sm,
    borderTopRightRadius: ClearLensRadii.sm,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: ClearLensColors.mint,
  },
  envelopeBody: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: ClearLensColors.surface,
    borderWidth: 1.5,
    borderColor: ClearLensColors.mint,
    borderRadius: ClearLensRadii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  envelopeLine: {
    height: 3,
    width: 48,
    backgroundColor: ClearLensColors.borderLight,
    borderRadius: 2,
  },
  envelopeLineShort: { width: 32 },
  badge: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ClearLensColors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    ...ClearLensTypography.h1,
    color: ClearLensColors.navy,
    textAlign: 'center',
  },
  body: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  emailHighlight: {
    fontFamily: ClearLensFonts.semiBold,
    color: ClearLensColors.navy,
  },

  tipsCard: {
    backgroundColor: ClearLensColors.mint50,
    borderRadius: ClearLensRadii.lg,
    borderWidth: 1,
    borderColor: ClearLensColors.mint,
    padding: ClearLensSpacing.md,
    gap: ClearLensSpacing.sm,
    width: '100%',
  },
  tipsLabel: {
    ...ClearLensTypography.label,
    color: ClearLensColors.emerald,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ClearLensSpacing.sm,
  },
  tipText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.navy,
    flex: 1,
    lineHeight: 20,
  },

  actions: {
    marginTop: ClearLensSpacing.sm,
    width: '100%',
    alignItems: 'center',
  },
  secondaryBtn: {
    paddingVertical: ClearLensSpacing.sm + 2,
    paddingHorizontal: ClearLensSpacing.lg,
    borderWidth: 1.5,
    borderColor: ClearLensColors.border,
    borderRadius: ClearLensRadii.md,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryBtnText: {
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.semiBold,
    color: ClearLensColors.textSecondary,
  },
});
