import { Platform } from 'react-native';

const DEV_AUTH_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DEV_AUTH_BYPASS === 'true';

function isLocalWebHost() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

export function canShowDevAuthShortcut() {
  if (!DEV_AUTH_ENABLED) return false;

  // Web previews can still evaluate with dev-like flags, so only trust the hostname.
  if (Platform.OS === 'web') {
    return isLocalWebHost();
  }

  return __DEV__;
}

export function getDevAuthCredentials() {
  return {
    email: process.env.EXPO_PUBLIC_DEV_AUTH_EMAIL?.trim() ?? '',
    password: process.env.EXPO_PUBLIC_DEV_AUTH_PASSWORD ?? '',
  };
}
