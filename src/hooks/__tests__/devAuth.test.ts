type DevAuthModule = typeof import('@/src/lib/devAuth');

type DevAuthOptions = {
  enabled?: boolean;
  hostname?: string;
  isDev?: boolean;
  platform?: string;
};

const originalEnv = process.env;

function setGlobalFlag(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
  });
}

async function loadDevAuth({
  enabled = false,
  hostname,
  isDev = false,
  platform = 'ios',
}: DevAuthOptions = {}): Promise<DevAuthModule> {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    EXPO_PUBLIC_ENABLE_DEV_AUTH_BYPASS: enabled ? 'true' : 'false',
  };
  setGlobalFlag('__DEV__', isDev);

  if (hostname) {
    setGlobalFlag('window', { location: { hostname } });
  } else {
    delete (globalThis as { window?: unknown }).window;
  }

  jest.doMock('react-native', () => ({ Platform: { OS: platform } }), { virtual: true });
  return import('@/src/lib/devAuth');
}

describe('devAuth', () => {
  afterEach(() => {
    process.env = originalEnv;
    delete (globalThis as { __DEV__?: boolean }).__DEV__;
    delete (globalThis as { window?: unknown }).window;
    jest.dontMock('react-native');
    jest.resetModules();
  });

  it('hides the shortcut when the bypass flag is disabled', async () => {
    const { canShowDevAuthShortcut } = await loadDevAuth({
      enabled: false,
      isDev: true,
      platform: 'web',
      hostname: 'localhost',
    });

    expect(canShowDevAuthShortcut()).toBe(false);
  });

  it('shows the shortcut in dev mode when the bypass flag is enabled', async () => {
    const { canShowDevAuthShortcut } = await loadDevAuth({
      enabled: true,
      isDev: true,
      platform: 'ios',
    });

    expect(canShowDevAuthShortcut()).toBe(true);
  });

  it('shows the shortcut on local web hosts outside dev mode', async () => {
    const { canShowDevAuthShortcut } = await loadDevAuth({
      enabled: true,
      hostname: '127.0.0.1',
      platform: 'web',
    });

    expect(canShowDevAuthShortcut()).toBe(true);
  });

  it('hides the shortcut on non-local web hosts outside dev mode', async () => {
    const { canShowDevAuthShortcut } = await loadDevAuth({
      enabled: true,
      hostname: 'app.foliolens.in',
      platform: 'web',
    });

    expect(canShowDevAuthShortcut()).toBe(false);
  });

  it('returns trimmed development credentials', async () => {
    const { getDevAuthCredentials } = await loadDevAuth();
    process.env.EXPO_PUBLIC_DEV_AUTH_EMAIL = ' beta@example.com ';
    process.env.EXPO_PUBLIC_DEV_AUTH_PASSWORD = 'secret';

    expect(getDevAuthCredentials()).toEqual({
      email: 'beta@example.com',
      password: 'secret',
    });
  });
});
