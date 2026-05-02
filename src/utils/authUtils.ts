/**
 * Extract the PKCE authorization code from an OAuth callback URL.
 *
 * Works with both custom scheme and HTTPS URLs:
 *   foliolens://auth/callback?code=abc123
 *   https://example.com/auth/callback?code=abc123
 *
 * Returns null if no code is present (error redirect or cancelled flow).
 */
export function parseOAuthCode(url: string): string | null {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return null;
  // Strip any trailing hash fragment so it doesn't pollute the query string
  const queryString = url.slice(queryStart + 1).split('#')[0];
  return new URLSearchParams(queryString).get('code');
}

export function parseSessionFromUrl(url: string): {
  accessToken: string;
  refreshToken: string;
} | null {
  const fragment = url.split('#')[1];
  if (!fragment) return null;

  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
  };
}
