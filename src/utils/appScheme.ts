import Constants from 'expo-constants';

export function getAppScheme(): string {
  const extraScheme = Constants.expoConfig?.extra?.appScheme;
  const configScheme = Constants.expoConfig?.scheme;

  if (typeof extraScheme === 'string' && extraScheme.length > 0) return extraScheme;
  if (typeof configScheme === 'string' && configScheme.length > 0) return configScheme;
  if (typeof process.env.EXPO_PUBLIC_APP_SCHEME === 'string' && process.env.EXPO_PUBLIC_APP_SCHEME.length > 0) {
    return process.env.EXPO_PUBLIC_APP_SCHEME;
  }

  return 'fundlens';
}

export function getNativeAuthOrigin(): string {
  return `${getAppScheme()}://`;
}

export function getNativeBridgeUrl(path: '/auth/confirm' | '/auth/callback'): string {
  const scheme = encodeURIComponent(getAppScheme());
  return `https://fund-lens.vercel.app${path}?scheme=${scheme}`;
}
