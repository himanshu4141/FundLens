import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Logo from '@/src/components/Logo';
import { useThemeVariant } from '@/src/hooks/useThemeVariant';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';

export default function ConfirmScreen() {
  const router = useRouter();
  const theme = useThemeVariant();

  /**
   * Web-only: bridge magic-link tokens back into the native app.
   *
   * When a native user clicks the magic link, the email client opens
   * https://fund-lens.vercel.app/auth/confirm#access_token=...
   * in its browser. We immediately redirect to fundlens://auth/confirm with
   * the same hash so the native app can pick up the session via Linking.
   *
   * If no native app is installed (web user on desktop), the fundlens://
   * attempt silently fails and the Supabase client's detectSessionInUrl
   * handles the web session from the hash instead — AuthGate then navigates
   * to /(tabs) normally.
   */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) return;

    // Only attempt the scheme handoff from mobile browsers. Desktop web sign-ins
    // should stay in the browser and let Supabase complete the session normally.
    const ua = window.navigator.userAgent.toLowerCase();
    if (!/iphone|ipad|ipod|android/.test(ua)) return;

    // Attempt to hand off to native app; browser ignores this if no app is installed.
    window.location.replace(`fundlens://auth/confirm${hash}`);
  }, []);

  async function handleResend() {
    // We don't have the email on this screen — route back to sign-in to re-enter it.
    router.replace('/auth');
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Logo at top */}
      <View style={styles.logoArea}>
        <Logo size={44} showWordmark color={theme.colors.primary} />
      </View>

      {/* Envelope illustration — built from primitives, no emoji dependency */}
      <View style={styles.illustrationWrap}>
        <View style={styles.envelope}>
          <View style={styles.envelopeFlap} />
          <View style={styles.envelopeBody}>
            <View style={styles.envelopeLine} />
            <View style={[styles.envelopeLine, styles.envelopeLineShort]} />
          </View>
          {/* Animated dot — subtle activity signal */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>Magic link sent</Text>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Check your inbox</Text>

      <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
        We sent a secure sign-in link to your email. Tap it to open FundLens — no
        password needed.
      </Text>

      <View style={[styles.tips, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
          ⏱ The link expires in 10 minutes.
        </Text>
        <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
          📂 Check your spam folder if you don&apos;t see it.
        </Text>
        <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
          📱 Open the link on this device for the smoothest experience.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: theme.colors.border }]}
          onPress={handleResend}
          activeOpacity={0.75}
        >
          <Text style={[styles.secondaryBtnText, { color: theme.colors.textSecondary }]}>
            Use a different email
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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

  // ── Illustration ──
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

  // ── Text ──
  eyebrow: {
    ...Typography.label,
    textTransform: 'uppercase',
    textAlign: 'center',
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
