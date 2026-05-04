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
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import { canShowDevAuthShortcut, getDevAuthCredentials } from '@/src/lib/devAuth';
import Logo from '@/src/components/Logo';
import { FolioLensLogo } from '@/src/components/clearLens/FolioLensLogo';
import { GoogleIcon } from '@/src/components/GoogleIcon';
import { getNativeAuthOrigin, getNativeBridgeUrl } from '@/src/utils/appScheme';
import { parseOAuthCode } from '@/src/utils/authUtils';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import { useResponsiveLayout } from '@/src/components/responsive';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';

function getRedirectUrl(): string {
  if (Platform.OS !== 'web') return getNativeBridgeUrl('/auth/confirm');
  return `${window.location.origin}/auth/confirm`;
}

const VALUE_PROPS = [
  { icon: '📈', text: 'Your actual SIP returns, not misleading averages' },
  { icon: '⚖️', text: 'Beat the market? Know in one glance' },
  { icon: '🔍', text: 'Fund vs. benchmark, the honest way' },
];

const CL_VALUE_PROPS = [
  { icon: 'trending-up-outline' as const, text: 'Your actual SIP returns, not misleading averages' },
  { icon: 'scale-outline' as const, text: 'Beat the market? Know in one glance' },
  { icon: 'search-outline' as const, text: 'Fund vs. benchmark, the honest way' },
];

export default function SignInScreen() {
  const router = useRouter();
  const { isClearLens } = useAppDesignMode();
  const { layout } = useResponsiveLayout();
  const isDesktop = layout === 'desktop';
  const [email, setEmail] = useState('');
  const [loadingMode, setLoadingMode] = useState<'magic' | 'google' | 'demo' | null>(null);
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

    router.push(`/auth/confirm?email=${encodeURIComponent(email.trim())}`);
  }

  async function handleGoogleSignIn() {
    setError(null);
    setLoadingMode('google');

    const redirectTo = Platform.OS === 'web'
      ? `${window.location.origin}/auth/callback`
      : getNativeBridgeUrl('/auth/callback');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error || !data?.url) {
      setError(error?.message ?? 'Could not start Google sign-in. Please try again.');
      setLoadingMode(null);
      return;
    }

    if (Platform.OS === 'web') {
      window.location.href = data.url;
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, getNativeAuthOrigin());
    setLoadingMode(null);

    if (result.type === 'success') {
      const code = parseOAuthCode(result.url);
      if (code) {
        router.push(
          `/auth/callback?code=${encodeURIComponent(code)}&callbackUrl=${encodeURIComponent(result.url)}`,
        );
      }
    }
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

  // ── ClearLens design ──
  if (isClearLens) {
    return (
      <KeyboardAvoidingView
        style={clStyles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[clStyles.scroll, isDesktop && clStyles.scrollDesktop]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={isDesktop ? clStyles.cardDesktop : clStyles.cardMobile}>
          {/* Hero */}
          <LinearGradient
            colors={[ClearLensColors.navy, ClearLensColors.slate]}
            style={[clStyles.hero, isDesktop && clStyles.heroDesktop]}
          >
            <FolioLensLogo size={36} light showWordmark />

            <View style={clStyles.heroTextBlock}>
              <Text style={clStyles.heroHeadline}>
                Know if you&apos;re{'\n'}beating the market.
              </Text>
              <Text style={clStyles.heroAccent}>No jargon. No noise.</Text>
            </View>

            <View style={clStyles.valueProps}>
              {CL_VALUE_PROPS.map(({ icon, text }) => (
                <View key={text} style={clStyles.valuePropRow}>
                  <View style={clStyles.valuePropIconWrap}>
                    <Ionicons name={icon} size={15} color={ClearLensColors.mint} />
                  </View>
                  <Text style={clStyles.valuePropText}>{text}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          {/* Form panel */}
          <View style={clStyles.formPanel}>
            <Text style={clStyles.formTitle}>Sign in</Text>
            <Text style={clStyles.formSubtitle}>
              Enter your email — we&apos;ll send a secure link. No password needed.
            </Text>

            <TextInput
              style={[clStyles.input, error ? clStyles.inputError : null]}
              placeholder="you@example.com"
              placeholderTextColor={ClearLensColors.textTertiary}
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

            {error && <Text style={clStyles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[clStyles.button, loadingMode !== null && clStyles.buttonDisabled]}
              onPress={handleSendMagicLink}
              disabled={loadingMode !== null}
              activeOpacity={0.85}
            >
              {loadingMode === 'magic' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={clStyles.buttonText}>Send secure link →</Text>
              )}
            </TouchableOpacity>

            <View style={clStyles.dividerRow}>
              <View style={clStyles.divider} />
              <Text style={clStyles.dividerText}>or</Text>
              <View style={clStyles.divider} />
            </View>

            <TouchableOpacity
              style={[clStyles.googleButton, loadingMode !== null && clStyles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={loadingMode !== null}
              activeOpacity={0.85}
            >
              {loadingMode === 'google' ? (
                <ActivityIndicator color={ClearLensColors.textSecondary} />
              ) : (
                <>
                  <GoogleIcon size={20} />
                  <Text style={clStyles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {showDevAuthShortcut && (
              <>
                <View style={clStyles.devDividerRow}>
                  <View style={clStyles.devDivider} />
                  <Text style={clStyles.devDividerText}>Local development only</Text>
                  <View style={clStyles.devDivider} />
                </View>

                <TouchableOpacity
                  style={[clStyles.devButton, loadingMode !== null && clStyles.buttonDisabled]}
                  onPress={handleDevSignIn}
                  disabled={loadingMode !== null}
                  activeOpacity={0.85}
                >
                  {loadingMode === 'demo' ? (
                    <ActivityIndicator color={ClearLensColors.emerald} />
                  ) : (
                    <Text style={clStyles.devButtonText}>Continue as demo user</Text>
                  )}
                </TouchableOpacity>

                <Text style={clStyles.devHint}>
                  Uses locally configured demo credentials. Keep this disabled outside local development.
                </Text>
              </>
            )}

            <TouchableOpacity
              style={clStyles.infoToggle}
              onPress={() => setShowMagicLinkInfo((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={clStyles.infoToggleText}>
                {showMagicLinkInfo ? '▲' : '▼'} What is a magic link?
              </Text>
            </TouchableOpacity>

            {showMagicLinkInfo && (
              <View style={clStyles.infoBox}>
                <Text style={clStyles.infoBoxText}>
                  A magic link is a one-time, expiring link we email you. Tap it to sign in
                  instantly — no password to remember, nothing to forget. The link expires in
                  10 minutes and can only be used once.
                </Text>
              </View>
            )}

            <View style={clStyles.securityNote}>
              <Ionicons name="lock-closed-outline" size={12} color={ClearLensColors.textTertiary} />
              <Text style={clStyles.securityNoteText}>
                Your data is private and encrypted. We never share it.
              </Text>
            </View>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Classic design ──
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

          {/* ── Or divider ── */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          {/* ── Google sign-in ── */}
          <TouchableOpacity
            style={[styles.googleButton, loadingMode !== null && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={loadingMode !== null}
            activeOpacity={0.85}
          >
            {loadingMode === 'google' ? (
              <ActivityIndicator color={Colors.textSecondary} />
            ) : (
              <>
                <GoogleIcon size={20} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
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

// ── Classic styles ──
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
  },

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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  googleButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  googleButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
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

// ── ClearLens styles ──
const clStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ClearLensColors.navy,
  },
  scroll: {
    flexGrow: 1,
  },
  scrollDesktop: {
    paddingVertical: ClearLensSpacing.xl,
    paddingHorizontal: ClearLensSpacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  } as never,
  cardMobile: {
    flex: 1,
  },
  cardDesktop: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: ClearLensColors.surface,
    borderRadius: ClearLensRadii.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
  },
  heroDesktop: {
    paddingTop: ClearLensSpacing.xl,
  },

  hero: {
    paddingTop: Platform.OS === 'ios' ? 64 : 48,
    paddingBottom: ClearLensSpacing.xl + ClearLensRadii.xl,
    paddingHorizontal: ClearLensSpacing.lg,
    gap: ClearLensSpacing.lg,
  },
  heroTextBlock: {
    gap: ClearLensSpacing.xs,
    marginTop: ClearLensSpacing.sm,
  },
  heroHeadline: {
    fontFamily: ClearLensFonts.extraBold,
    fontSize: 28,
    lineHeight: 34,
    color: ClearLensColors.textOnDark,
    letterSpacing: 0,
  },
  heroAccent: {
    fontFamily: ClearLensFonts.bold,
    fontSize: 22,
    lineHeight: 28,
    color: ClearLensColors.emerald,
    letterSpacing: 0,
  },
  valueProps: {
    gap: ClearLensSpacing.sm,
    marginTop: ClearLensSpacing.xs,
  },
  valuePropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  valuePropIconWrap: {
    width: 28,
    height: 28,
    borderRadius: ClearLensRadii.sm,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuePropText: {
    ...ClearLensTypography.bodySmall,
    color: 'rgba(255,255,255,0.78)',
    flex: 1,
  },

  formPanel: {
    backgroundColor: ClearLensColors.surface,
    borderTopLeftRadius: ClearLensRadii.xl,
    borderTopRightRadius: ClearLensRadii.xl,
    marginTop: -ClearLensRadii.xl,
    flex: 1,
    paddingHorizontal: ClearLensSpacing.lg,
    paddingTop: ClearLensSpacing.xl,
    paddingBottom: ClearLensSpacing.xxl,
    gap: ClearLensSpacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
  },
  formTitle: {
    ...ClearLensTypography.h2,
    color: ClearLensColors.navy,
  },
  formSubtitle: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textTertiary,
    marginTop: -ClearLensSpacing.sm,
  },

  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: ClearLensColors.border,
    borderRadius: ClearLensRadii.md,
    paddingHorizontal: ClearLensSpacing.md,
    fontSize: 16,
    color: ClearLensColors.textPrimary,
    backgroundColor: ClearLensColors.surfaceSoft,
  },
  inputError: {
    borderColor: ClearLensColors.negative,
  },
  errorText: {
    color: ClearLensColors.negative,
    fontSize: 13,
    marginTop: -ClearLensSpacing.sm,
  },

  button: {
    height: 54,
    backgroundColor: ClearLensColors.emerald,
    borderRadius: ClearLensRadii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    ...ClearLensTypography.h3,
    color: '#ffffff',
    letterSpacing: 0.2,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: ClearLensColors.border,
  },
  dividerText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    textTransform: 'uppercase',
  },

  googleButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ClearLensSpacing.sm,
    backgroundColor: ClearLensColors.surface,
    borderRadius: ClearLensRadii.md,
    borderWidth: 1.5,
    borderColor: ClearLensColors.border,
  },
  googleButtonText: {
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.semiBold,
    color: ClearLensColors.navy,
  },

  devDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    marginTop: ClearLensSpacing.xs,
  },
  devDivider: { flex: 1, height: 1, backgroundColor: ClearLensColors.border },
  devDividerText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    textTransform: 'uppercase',
  },
  devButton: {
    height: 48,
    borderRadius: ClearLensRadii.md,
    borderWidth: 1,
    borderColor: ClearLensColors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.mint50,
  },
  devButtonText: {
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.semiBold,
    color: ClearLensColors.emerald,
  },
  devHint: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
    marginTop: -ClearLensSpacing.xs,
  },

  infoToggle: {
    alignSelf: 'center',
    paddingVertical: ClearLensSpacing.xs,
  },
  infoToggleText: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.semiBold,
    color: ClearLensColors.emerald,
  },
  infoBox: {
    backgroundColor: ClearLensColors.mint50,
    borderRadius: ClearLensRadii.md,
    padding: ClearLensSpacing.md,
    marginTop: -ClearLensSpacing.sm,
    borderWidth: 1,
    borderColor: ClearLensColors.mint,
  },
  infoBoxText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.navy,
    lineHeight: 20,
  },

  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: ClearLensSpacing.sm,
  },
  securityNoteText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    textAlign: 'center',
  },
});
