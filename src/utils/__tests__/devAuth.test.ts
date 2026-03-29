describe('devAuth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns false when the bypass env flag is disabled', async () => {
    process.env.EXPO_PUBLIC_ENABLE_DEV_AUTH_BYPASS = 'false';
    jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));

    const { canShowDevAuthShortcut } = await import('@/src/lib/devAuth');

    expect(canShowDevAuthShortcut()).toBe(false);
  });

  it('allows the shortcut on localhost web when the env flag is enabled', async () => {
    process.env.EXPO_PUBLIC_ENABLE_DEV_AUTH_BYPASS = 'true';
    Object.defineProperty(global, 'window', {
      value: { location: { hostname: 'localhost' } },
      configurable: true,
    });
    jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));

    const { canShowDevAuthShortcut } = await import('@/src/lib/devAuth');

    expect(canShowDevAuthShortcut()).toBe(true);
  });

  it('hides the shortcut on non-local web hosts even when enabled', async () => {
    process.env.EXPO_PUBLIC_ENABLE_DEV_AUTH_BYPASS = 'true';
    Object.defineProperty(global, 'window', {
      value: { location: { hostname: 'preview.example.com' } },
      configurable: true,
    });
    jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));

    const { canShowDevAuthShortcut } = await import('@/src/lib/devAuth');

    expect(canShowDevAuthShortcut()).toBe(false);
  });

  it('returns trimmed dev credentials', async () => {
    process.env.EXPO_PUBLIC_DEV_AUTH_EMAIL = ' demo@fundlens.local ';
    process.env.EXPO_PUBLIC_DEV_AUTH_PASSWORD = 'secret';
    jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));

    const { getDevAuthCredentials } = await import('@/src/lib/devAuth');

    expect(getDevAuthCredentials()).toEqual({
      email: 'demo@fundlens.local',
      password: 'secret',
    });
  });
});
