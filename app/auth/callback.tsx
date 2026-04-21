import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import Logo from '@/src/components/Logo';
import { getAppScheme } from '@/src/utils/appScheme';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';

type CallbackState = 'exchanging' | 'linked' | 'error';

interface ErrorState {
  message: string;
  isDuplicate: boolean;
}

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const { code, error: oauthError, error_description, scheme } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
    scheme?: string;
  }>();
  const targetScheme = typeof scheme === 'string' && scheme.length > 0 ? scheme : getAppScheme();

  const [state, setState] = useState<CallbackState>('exchanging');
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [wasAutoLinked, setWasAutoLinked] = useState(false);

  useEffect(() => {
    // ── Web path ──────────────────────────────────────────────────────────────
    if (Platform.OS === 'web') {
      // Bridge to native app only when running at the production native-bridge
      // URL (fund-lens.vercel.app). Preview deployments serve the web app on a
      // different hostname — mobile visitors there should get a web session, not
      // an app redirect.
      const ua = window.navigator.userAgent.toLowerCase();
      const isNativeBridgeHost = window.location.hostname === 'fund-lens.vercel.app';
      if (/iphone|ipad|ipod|android/.test(ua) && isNativeBridgeHost) {
        // Preserve the full query string so the native app receives the code
        window.location.replace(`${targetScheme}://auth/callback` + window.location.search);
      }
      // Desktop web, or mobile on a non-bridge host: Supabase detectSessionInUrl
      // auto-exchanges the code. Show spinner; AuthGate navigates once session appears.
      return;
    }

    // ── Native path ───────────────────────────────────────────────────────────
    if (oauthError) {
      const desc = error_description ?? oauthError;
      const isDuplicate =
        oauthError === 'access_denied' ||
        desc.toLowerCase().includes('already');
      setErrorState({
        message: isDuplicate
          ? 'This email already has a FundLens account created with email sign-in. Sign in with your magic link first, then connect Google from Settings → Connected Accounts.'
          : `Sign-in failed: ${desc}`,
        isDuplicate,
      });
      setState('error');
      return;
    }

    if (!code) return;

    async function exchange() {
      try {
        // Pass the full reconstructed URL; Supabase extracts the code param
        // and retrieves the stored PKCE verifier from AsyncStorage automatically.
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          `${targetScheme}://auth/callback?code=${code}`,
        );

        if (error) {
          const isDuplicate = error.message.toLowerCase().includes('already');
          setErrorState({
            message: isDuplicate
              ? 'This email already has a FundLens account. Sign in with your magic link first, then connect Google from Settings → Connected Accounts.'
              : `Sign-in failed: ${error.message}`,
            isDuplicate,
          });
          setState('error');
          return;
        }

        // Detect whether Supabase auto-linked an existing email account
        const identities = data.session?.user?.identities ?? [];
        const hasEmail = identities.some((id: { provider: string }) => id.provider === 'email');
        const hasGoogle = identities.some((id: { provider: string }) => id.provider === 'google');
        if (hasEmail && hasGoogle) {
          setWasAutoLinked(true);
        }

        setState('linked');
        // AuthGate in _layout.tsx watches onAuthStateChange and will
        // replace the route to /(tabs) once the session is established.
      } catch {
        setErrorState({
          message: 'An unexpected error occurred. Please try again.',
          isDuplicate: false,
        });
        setState('error');
      }
    }

    exchange();
  }, [code, oauthError, error_description, targetScheme]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Logo size={44} showWordmark />
        <ActivityIndicator size="large" color={Colors.primary} style={styles.spinner} />
        <Text style={styles.loadingText}>Signing you in…</Text>
      </View>
    );
  }

  if (state === 'error' && errorState) {
    return (
      <View style={styles.container}>
        <View style={styles.logoArea}>
          <Logo size={44} showWordmark />
        </View>

        <View style={styles.messageCard}>
          <Text style={styles.cardTitle}>
            {errorState.isDuplicate ? 'Account already exists' : 'Sign-in failed'}
          </Text>
          <Text style={styles.cardBody}>{errorState.message}</Text>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace('/auth')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>
            {errorState.isDuplicate ? 'Sign in with email instead' : 'Try again'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (state === 'linked' && wasAutoLinked) {
    return (
      <View style={styles.container}>
        <View style={styles.logoArea}>
          <Logo size={44} showWordmark />
        </View>

        <View style={[styles.messageCard, styles.successCard]}>
          <Text style={styles.cardTitle}>Google account connected</Text>
          <Text style={styles.cardBody}>
            Your Google account has been connected to your existing FundLens account.
            You can now sign in with either method.
          </Text>
        </View>

        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.loadingText}>Taking you in…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoArea}>
        <Logo size={44} showWordmark />
      </View>
      <ActivityIndicator size="large" color={Colors.primary} style={styles.spinner} />
      <Text style={styles.loadingText}>Completing sign-in…</Text>
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
  spinner: {
    marginVertical: Spacing.sm,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  messageCard: {
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    gap: Spacing.sm,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  successCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  cardTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  cardBody: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  primaryBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryBtnText: {
    color: Colors.textOnDark,
    fontSize: 16,
    fontWeight: '700',
  },
});
