/**
 * Helpers for the per-user CAS inbox address.
 *
 * Each user has an opaque `cas_inbox_token` stored on `user_profile`.
 * Their forwarding address is `cas+<token>@foliolens.in`.
 *
 * The Resend Inbound Route catches anything matching `cas+*@foliolens.in`
 * and POSTs it to the `cas-webhook-resend` Edge Function. The function
 * pulls the token out of the `to` header and looks up the user. These
 * helpers are shared between the client (Settings + onboarding UI) and
 * the unit tests; the Edge Function reproduces the same parsing inline
 * because Deno cannot import from `src/`.
 */

const INBOX_DOMAIN = 'foliolens.in';
// Alphabet matches the SQL generator: A–Z minus I, L, O; 2–9.
const TOKEN_REGEX = /^[A-HJKMNP-Z2-9]{8}$/;

/**
 * Build the user-facing address from a token.
 *
 * Throws on invalid token shape so a UI can never show a malformed address.
 */
export function formatInboxAddress(token: string): string {
  if (!isValidInboxToken(token)) {
    throw new Error(`Invalid inbox token: ${JSON.stringify(token)}`);
  }
  return `cas+${token}@${INBOX_DOMAIN}`;
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
 * Returns the token (uppercased to canonical form) or null if not found.
 */
export function parseInboxToken(toHeader: string | null | undefined): string | null {
  if (!toHeader) return null;
  // Match `cas+TOKEN@foliolens.in` anywhere inside the header (handles
  // angle brackets, display names, multiple recipients).
  const re = new RegExp(`cas\\+([A-Za-z0-9]+)@${escapeRegex(INBOX_DOMAIN)}`, 'i');
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
