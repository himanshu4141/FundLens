import Constants from 'expo-constants';
import {
  getAppScheme,
  getNativeAuthOrigin,
  getNativeBridgeUrl,
  getNativeExchangeCallbackUrl,
} from '../appScheme';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {},
  },
}));

type ExpoConstantsShape = {
  expoConfig?: {
    extra?: {
      appScheme?: string;
    };
    scheme?: string;
  };
};

describe('appScheme helpers', () => {
  const originalEnv = process.env.EXPO_PUBLIC_APP_SCHEME;
  const constants = Constants as ExpoConstantsShape;

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_APP_SCHEME;
    constants.expoConfig = {};
  });

  afterAll(() => {
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_APP_SCHEME;
    } else {
      process.env.EXPO_PUBLIC_APP_SCHEME = originalEnv;
    }
  });

  it('prefers expo extra appScheme when available', () => {
    constants.expoConfig = {
      extra: { appScheme: 'fundlens-pr' },
      scheme: 'fundlens',
    };

    expect(getAppScheme()).toBe('fundlens-pr');
  });

  it('falls back to expoConfig.scheme when extra appScheme is missing', () => {
    constants.expoConfig = {
      scheme: 'fundlens-main',
    };

    expect(getAppScheme()).toBe('fundlens-main');
  });

  it('falls back to EXPO_PUBLIC_APP_SCHEME when expo config is unavailable', () => {
    process.env.EXPO_PUBLIC_APP_SCHEME = 'fundlens-dev';

    expect(getAppScheme()).toBe('fundlens-dev');
  });

  it('defaults to fundlens when no override exists', () => {
    expect(getAppScheme()).toBe('fundlens');
  });

  it('builds the native auth origin from the resolved scheme', () => {
    constants.expoConfig = {
      extra: { appScheme: 'fundlens-main' },
    };

    expect(getNativeAuthOrigin()).toBe('fundlens-main://');
  });

  it('builds confirm and callback bridge URLs with an encoded scheme', () => {
    constants.expoConfig = {
      extra: { appScheme: 'fundlens pr' },
    };

    expect(getNativeBridgeUrl('/auth/confirm')).toBe(
      'https://fund-lens.vercel.app/auth/confirm?scheme=fundlens%20pr',
    );
    expect(getNativeBridgeUrl('/auth/callback')).toBe(
      'https://fund-lens.vercel.app/auth/callback?scheme=fundlens%20pr',
    );
  });

  it('builds an HTTPS callback exchange URL when a native callback URL is missing', () => {
    constants.expoConfig = {
      extra: { appScheme: 'fundlens-pr' },
    };

    expect(getNativeExchangeCallbackUrl('abc+123')).toBe(
      'https://fund-lens.vercel.app/auth/callback?scheme=fundlens-pr&code=abc%2B123',
    );
  });

  it('prefers the provided callback URL when one is available', () => {
    expect(
      getNativeExchangeCallbackUrl(
        'ignored',
        'fundlens-pr://auth/callback?code=abc123&state=xyz',
      ),
    ).toBe('fundlens-pr://auth/callback?code=abc123&state=xyz');
  });
});
