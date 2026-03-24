import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { canShowDevAuthShortcut, getDevAuthCredentials } from '@/src/lib/devAuth';
import Logo from '@/src/components/Logo';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';

/**
 * On web, use window.location.origin so the redirect works on any domain
 * (local dev, Vercel preview, production) without hardcoding anything.
 *
 * On native, use the production HTTPS URL instead of fundlens:// directly.
 * In-app browsers (Gmail WKWebView, etc.) reliably follow HTTPS redirects but
 * may silently drop custom scheme redirects. The /auth/confirm web page acts
 * as a bridge: it reads the tokens from the URL hash and immediately tries to
 * open fundlens://auth/confirm with the same hash, handing control back to the
 * native app. The web session is set as a fallback if the native app can't open.
 */
function getRedirectUrl(): string {
  if (Platform.OS !== 'web') return 'https://fund-lens.vercel.app/auth/confirm';
  return `${window.location.origin}/auth/confirm`;
}

const VALUE_PROPS = [
  { icon: '📈', text: 'Your actual SIP returns, not misleading averages' },
  { icon: '⚖️', text: 'Beat the market? Know in one glance' },
  { icon: '🔍', text: 'Fund vs. benchmark, the honest way' },
];

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loadingMode, setLoadingMode] = useState<'magic' | 'demo' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMagicLinkInfo, setShowMagicLinkInfo] = useState(false);
  const showDevAuthShortcut = canShowDevAuthShortcut();

  async function handleSendMagicLink() {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setError(null);
    setLoadingMode('magic');

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: getRedirectUrl(),
      },
    });

    setLoadingMode(null);

    if (error) {
      setError(error.message);
      return;
    }

    router.push('/auth/confirm');
  }

  async function handleDevSignIn() {
    const { email: devEmail, password: devPassword } = getDevAuthCredentials();

    if (!devEmail || !devPassword) {
      setError(
        'Dev auth is enabled, but EXPO_PUBLIC_DEV_AUTH_EMAIL or EXPO_PUBLIC_DEV_AUTH_PASSWORD is missing in .env.local.',
      );
      return;
    }

    setError(null);
    setLoadingMode('demo');

    const { error } = await supabase.auth.signInWithPassword({
      email: devEmail,
      password: devPassword,
    });

    setLoadingMode(null);

    if (error) {
      setError(error.message);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero panel ── */}
        <LinearGradient colors={Colors.gradientHero} style={styles.hero}>
          <Logo size={52} showWordmark light />

          <Text style={styles.heroTagline}>
            Know if you&apos;re beating the market.{'\n'}No jargon. No noise.
          </Text>

          {/* Value props */}
          <View style={styles.valueProps}>
            {VALUE_PROPS.map(({ icon, text }) => (
              <View key={text} style={styles.valuePropRow}>
                <Text style={styles.valuePropIcon}>{icon}</Text>
                <Text style={styles.valuePropText}>{text}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* ── Form panel ── */}
        <View style={styles.formPanel}>
          <Text style={styles.formTitle}>Sign in</Text>
          <Text style={styles.formSubtitle}>
            Enter your email — we&apos;ll send a secure link. No password needed.
          </Text>

          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textTertiary}
            value={email}
            onChangeText={(v) => { setEmail(v); setError(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!loadingMode}
            returnKeyType="send"
            onSubmitEditing={handleSendMagicLink}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, loadingMode !== null && styles.buttonDisabled]}
            onPress={handleSendMagicLink}
            disabled={loadingMode !== null}
            activeOpacity={0.85}
          >
            {loadingMode === 'magic' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send secure link →</Text>
            )}
          </TouchableOpacity>

          {showDevAuthShortcut && (
            <>
              <View style={styles.devDividerRow}>
                <View style={styles.devDivider} />
                <Text style={styles.devDividerText}>Local development only</Text>
                <View style={styles.devDivider} />
              </View>

              <TouchableOpacity
                style={[styles.devButton, loadingMode !== null && styles.buttonDisabled]}
                onPress={handleDevSignIn}
                disabled={loadingMode !== null}
                activeOpacity={0.85}
              >
                {loadingMode === 'demo' ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <Text style={styles.devButtonText}>Continue as demo user</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.devHint}>
                Uses locally configured demo credentials. Keep this disabled outside local development.
              </Text>
            </>
          )}

          {/* Magic link explainer */}
          <TouchableOpacity
            style={styles.infoToggle}
            onPress={() => setShowMagicLinkInfo((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.infoToggleText}>
              {showMagicLinkInfo ? '▲' : '▼'} What is a magic link?
            </Text>
          </TouchableOpacity>

          {showMagicLinkInfo && (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                A magic link is a one-time, expiring link we email you. Tap it to sign in
                instantly — no password to remember, nothing to forget. The link expires in
                10 minutes and can only be used once.
              </Text>
            </View>
          )}

          <Text style={styles.securityNote}>
            🔒 Your data is private and encrypted. We never share it.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
  },

  // ── Hero ──
  hero: {
    paddingTop: Platform.OS === 'ios' ? 64 : 48,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  heroTagline: {
    ...Typography.h2,
    color: '#ffffff',
    lineHeight: 32,
    marginTop: Spacing.sm,
  },
  valueProps: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  valuePropRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  valuePropIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  valuePropText: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.80)',
    flex: 1,
    lineHeight: 20,
  },

  // ── Form ──
  formPanel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    marginTop: -Radii.xl,
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
    // Subtle top shadow to lift panel over hero
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
  },
  formTitle: {
    ...Typography.h1,
    color: Colors.textPrimary,
  },
  formSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: -Spacing.sm,
  },

  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceAlt,
  },
  inputError: {
    borderColor: Colors.negative,
  },
  errorText: {
    color: Colors.negative,
    fontSize: 13,
    marginTop: -Spacing.sm,
  },

  button: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.textOnDark,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  devDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  devDivider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  devDividerText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  devButton: {
    height: 48,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  devButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  devHint: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: -Spacing.xs,
  },

  infoToggle: {
    alignSelf: 'center',
    paddingVertical: Spacing.xs,
  },
  infoToggleText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radii.sm,
    padding: Spacing.md,
    marginTop: -Spacing.sm,
  },
  infoBoxText: {
    ...Typography.bodySmall,
    color: Colors.primaryDark,
    lineHeight: 20,
  },

  securityNote: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
