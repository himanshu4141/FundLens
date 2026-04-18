/**
 * Extract the PKCE authorization code from an OAuth callback URL.
 *
 * Works with both custom scheme and HTTPS URLs:
 *   fundlens://auth/callback?code=abc123
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
