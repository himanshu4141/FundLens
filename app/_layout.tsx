import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '@/src/lib/queryClient';
import { useSession } from '@/src/hooks/useSession';
import { supabase } from '@/src/lib/supabase';
import { ThemeProvider } from '@/src/context/ThemeContext';

/**
 * Parse a magic-link deep-link URL and establish a Supabase session.
 *
 * Supabase magic links land at fundlens://auth/confirm with the tokens in
 * the URL hash fragment, e.g.:
 *   fundlens://auth/confirm#access_token=xxx&refresh_token=yyy&type=magiclink
 *
 * On native `detectSessionInUrl` is false so Supabase won't pick these up
 * automatically — we parse and forward them ourselves.
 *
 * NOTE: Google OAuth (PKCE) callbacks do NOT flow through this function.
 * They arrive as fundlens://auth/callback?code=... and are handled entirely
 * within app/auth/callback.tsx, which calls supabase.auth.exchangeCodeForSession.
 * The openAuthSessionAsync call in auth/index.tsx returns the URL directly,
 * so the Linking listener below never fires for OAuth callbacks.
 */
function handleAuthDeepLink(url: string) {
  const fragment = url.split('#')[1];
  if (!fragment) return;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  }
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      router.replace('/auth');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    // Web: Supabase handles the hash fragment natively via detectSessionInUrl
    if (Platform.OS === 'web') return;

    // Cold-start: app was launched by tapping the magic link
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthDeepLink(url);
    });

    // Warm-start: app was already open when the link arrived
    const subscription = Linking.addEventListener('url', ({ url }) => handleAuthDeepLink(url));
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="auth" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="fund/[id]" options={{ headerShown: true, title: '' }} />
            <Stack.Screen name="onboarding" />
          </Stack>
        </AuthGate>
      </SafeAreaProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
