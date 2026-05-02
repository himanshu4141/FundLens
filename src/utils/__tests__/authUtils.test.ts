import { parseOAuthCode, parseSessionFromUrl } from '../authUtils';

// ---------------------------------------------------------------------------
// parseOAuthCode
// ---------------------------------------------------------------------------

describe('parseOAuthCode', () => {
  describe('returns the code when present in the query string', () => {
    it('extracts code from a custom scheme callback URL', () => {
      expect(parseOAuthCode('foliolens://auth/callback?code=abc123')).toBe('abc123');
    });

    it('extracts code from an HTTPS callback URL', () => {
      expect(parseOAuthCode('https://foliolens.vercel.app/auth/callback?code=xyz789')).toBe('xyz789');
    });

    it('extracts code when multiple query params are present', () => {
      expect(parseOAuthCode('foliolens://auth/callback?state=foo&code=bar456&scope=email')).toBe('bar456');
    });

    it('strips hash fragment before parsing so it does not interfere', () => {
      expect(parseOAuthCode('foliolens://auth/callback?code=abc&state=x#ignored')).toBe('abc');
    });

    it('decodes percent-encoded code values', () => {
      expect(parseOAuthCode('foliolens://auth/callback?code=abc%2B123')).toBe('abc+123');
    });
  });

  describe('returns null when no code is present', () => {
    it('returns null for a URL with no query string', () => {
      expect(parseOAuthCode('foliolens://auth/callback')).toBeNull();
    });

    it('returns null for an error redirect', () => {
      expect(parseOAuthCode('foliolens://auth/callback?error=access_denied&error_description=User+cancelled')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(parseOAuthCode('')).toBeNull();
    });

    it('returns null for a URL whose only fragment is a hash (magic-link style)', () => {
      expect(parseOAuthCode('foliolens://auth/confirm#access_token=xyz&refresh_token=abc')).toBeNull();
    });

    it('returns null when the query string has params but none is "code"', () => {
      expect(parseOAuthCode('foliolens://auth/callback?state=abc&scope=openid')).toBeNull();
    });
  });
});

describe('parseSessionFromUrl', () => {
  it('extracts access and refresh tokens from a fragment URL', () => {
    expect(
      parseSessionFromUrl(
        'foliolens://auth/callback#access_token=token123&refresh_token=refresh456&type=bearer',
      ),
    ).toEqual({
      accessToken: 'token123',
      refreshToken: 'refresh456',
    });
  });

  it('returns null when the fragment is missing', () => {
    expect(parseSessionFromUrl('foliolens://auth/callback?code=abc123')).toBeNull();
  });

  it('returns null when only one token is present', () => {
    expect(parseSessionFromUrl('foliolens://auth/callback#access_token=token123')).toBeNull();
  });
});
