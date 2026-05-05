/**
 * Helpers for the per-user CAS inbox address.
 *
 * Each user has an opaque `cas_inbox_token` stored on `user_profile`.
 * Their forwarding address is `cas+<token>@<INBOUND_DOMAIN>`.
 *
 * INBOUND_DOMAIN differs by environment so dev tester emails never land
 * in prod (and vice versa) even though both share one Resend account:
 *
 *   - dev / preview: `dev.foliolens.in`
 *   - prod:          `foliolens.in`
 *
 * Resolved from `EXPO_PUBLIC_INBOUND_DOMAIN`, falling back to
 * `foliolens.in` so a missing env var keeps prod working.
 *
 * The Resend Inbound Route per environment catches anything matching
 * `cas+*@<INBOUND_DOMAIN>` and POSTs it to the `cas-webhook-resend` Edge
 * Function. The function pulls the token out of the `to` header and looks
 * up the user. These helpers are shared between the client (Settings +
 * onboarding UI) and the unit tests; the Edge Function reproduces the
 * same parsing inline because Deno cannot import from `src/`.
 */

// Alphabet matches the SQL generator: A–Z minus I, L, O; 2–9.
const TOKEN_REGEX = /^[A-HJKMNP-Z2-9]{8}$/;
const DEFAULT_INBOX_DOMAIN = 'foliolens.in';

export function getInboxDomain(): string {
  const fromEnv = process.env.EXPO_PUBLIC_INBOUND_DOMAIN;
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_INBOX_DOMAIN;
}

/**
 * Build the user-facing address from a token.
 *
 * Throws on invalid token shape so a UI can never show a malformed address.
 */
export function formatInboxAddress(token: string): string {
  if (!isValidInboxToken(token)) {
    throw new Error(`Invalid inbox token: ${JSON.stringify(token)}`);
  }
  return `cas+${token}@${getInboxDomain()}`;
}

/**
 * Extract the inbox token from a raw `to` header value.
 *
 * Handles all common forms a mail client may send:
 *   - "cas+ABC23456@foliolens.in"
 *   - "<cas+ABC23456@foliolens.in>"
 *   - "FolioLens <cas+ABC23456@foliolens.in>"
 *   - "cas+abc23456@foliolens.in"           (case-insensitive)
 *   - "cas+ABC23456@foliolens.in, foo@bar"  (multi-recipient — first match wins)
 *
 * The host is taken from the env-resolved inbound domain, so on dev the
 * parser only matches `cas+…@dev.foliolens.in` (and vice versa).
 *
 * Returns the token (uppercased to canonical form) or null if not found.
 */
export function parseInboxToken(toHeader: string | null | undefined): string | null {
  if (!toHeader) return null;
  const re = new RegExp(`cas\\+([A-Za-z0-9]+)@${escapeRegex(getInboxDomain())}`, 'i');
  const match = re.exec(toHeader);
  if (!match) return null;
  const candidate = match[1].toUpperCase();
  return isValidInboxToken(candidate) ? candidate : null;
}

export function isValidInboxToken(token: string): boolean {
  return typeof token === 'string' && TOKEN_REGEX.test(token);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
