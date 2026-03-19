import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Logo from '@/src/components/Logo';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';

export default function ConfirmScreen() {
  const router = useRouter();

  // The router state carries the email forward from the sign-in screen
  // If it isn't available (e.g. deep-link direct load), we still show the screen gracefully.

  async function handleResend() {
    // We don't have the email on this screen — route back to sign-in to re-enter it.
    router.replace('/auth');
  }

  return (
    <View style={styles.container}>
      {/* Logo at top */}
      <View style={styles.logoArea}>
        <Logo size={44} showWordmark />
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

      <Text style={styles.title}>Check your inbox</Text>

      <Text style={styles.body}>
        We sent a secure sign-in link to your email. Tap it to open FundLens — no
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
