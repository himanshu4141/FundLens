import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as SystemUI from 'expo-system-ui';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { queryClient } from '@/src/lib/queryClient';
import { useSession } from '@/src/hooks/useSession';
import { supabase } from '@/src/lib/supabase';
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';
import { parseSessionFromUrl } from '@/src/utils/authUtils';

// Required for expo-web-browser openAuthSessionAsync to complete on Android.
// When Chrome Custom Tabs redirects to the app's active scheme, Android opens the app via
// the deep link. This call detects that URL and resolves the pending
// openAuthSessionAsync promise. Without it, the promise never settles on Android.
WebBrowser.maybeCompleteAuthSession();

/**
 * Parse a magic-link deep-link URL and establish a Supabase session.
 *
 * Supabase magic links land at <scheme>://auth/confirm with the tokens in
 * the URL hash fragment, e.g.:
 *   foliolens-main://auth/confirm#access_token=xxx&refresh_token=yyy&type=magiclink
 *
 * On native `detectSessionInUrl` is false so Supabase won't pick these up
 * automatically — we parse and forward them ourselves.
 *
 * NOTE: Google OAuth (PKCE) callbacks do NOT flow through this function.
 * They arrive as <scheme>://auth/callback?code=... and are handled entirely
 * within app/auth/callback.tsx, which calls supabase.auth.exchangeCodeForSession.
 * The openAuthSessionAsync call in auth/index.tsx returns the URL directly,
 * so the Linking listener below never fires for OAuth callbacks.
 */
function handleAuthDeepLink(url: string) {
  const sessionTokens = parseSessionFromUrl(url);
  if (sessionTokens) {
    supabase.auth.setSession({
      access_token: sessionTokens.accessToken,
      refresh_token: sessionTokens.refreshToken,
    });
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
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

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

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemedAppShell />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function ThemedAppShell() {
  const { resolvedScheme, clearLens } = useTheme();

  useEffect(() => {
    // Sync the underlying system UI background so the splash transition and
    // pull-to-refresh halo match the resolved scheme.
    SystemUI.setBackgroundColorAsync(clearLens.colors.background).catch(() => {});
  }, [clearLens.colors.background]);

  useEffect(() => {
    // Web only: when the user picks a theme via the in-app picker, override
    // the OS-driven favicon swap so the tab icon tracks the picked scheme
    // instead of the system preference. The +html.tsx ships both variants
    // with `media="(prefers-color-scheme: …)"` for the no-JS first paint.
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const href = resolvedScheme === 'dark' ? '/favicon-dark.svg' : '/favicon.svg';
    const links = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
    links.forEach((link) => {
      link.removeAttribute('media');
      link.href = href;
    });
  }, [resolvedScheme]);

  return (
    <SafeAreaProvider>
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
      {/*
        The `key` forces a remount on scheme change so module-level
        StyleSheet.create blocks (which capture token values once) re-evaluate
        with the new palette. Cost: transient UI state (modals, scroll
        position) resets when the user toggles light/dark — acceptable for a
        rare preference change.
      */}
      <AuthGate key={resolvedScheme}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: clearLens.colors.background } }}>
          <Stack.Screen name="auth" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="fund/[id]" options={{ headerShown: true, title: '' }} />
          <Stack.Screen name="money-trail" options={{ headerShown: false }} />
          <Stack.Screen name="portfolio-insights" options={{ headerShown: true, title: 'Portfolio Insights' }} />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="tools" />
        </Stack>
      </AuthGate>
    </SafeAreaProvider>
  );
}
