import { Platform } from 'react-native';

const DEV_AUTH_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DEV_AUTH_BYPASS === 'true';

function isLocalWebHost() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

export function canShowDevAuthShortcut() {
  return DEV_AUTH_ENABLED && (__DEV__ || isLocalWebHost());
}

export function getDevAuthCredentials() {
  return {
    email: process.env.EXPO_PUBLIC_DEV_AUTH_EMAIL?.trim() ?? '',
    password: process.env.EXPO_PUBLIC_DEV_AUTH_PASSWORD ?? '',
  };
}
