/**
 * Pure helpers for detecting Gmail's auto-forward verification email.
 *
 * Exported separately so they can be unit-tested via Jest (the parent
 * `cas-webhook-resend/index.ts` uses Deno-only APIs and is not Jest-runnable).
 *
 * Background: when a user adds `cas-<token>@foliolens.in` or
 * `cas-dev-<token>@foliolens.in` as a Gmail
 * forwarding destination, Google emails a verification message FROM
 * `forwarding-noreply@google.com` containing a confirmation URL on a Gmail
 * host with a `/mail/vf-…` path. The user must click that URL (or enter a code
 * in Gmail's settings UI) for the auto-forward filter to activate.
 *
 * The webhook captures the URL onto `user_profile.cas_inbox_confirmation_url`
 * so the FolioLens UI can surface a "Confirm Gmail forwarding" button.
 */

const SENDER_RE = /(?:^|<|\s)forwarding-noreply@google\.com(?:$|>|\s)/i;
const SUBJECT_RE = /Gmail Forwarding Confirmation/i;
const URL_RE = /https:\/\/(?:mail|mail-settings|isolated\.mail)\.google\.com\/mail\/vf-[^\s"'<]+/;

export interface GmailVerificationInput {
  /** Either the raw `from` string or an object with email/name. */
  from?: string | { email?: string; name?: string };
  subject?: string;
  /** Email body — `text` and `html` are concatenated for URL search. */
  text?: string;
  html?: string;
}

export function getSenderEmail(from: GmailVerificationInput['from']): string {
  if (!from) return '';
  if (typeof from === 'string') return from;
  return from.email ?? '';
}

export function isGmailForwardingVerification(input: GmailVerificationInput): boolean {
  const sender = getSenderEmail(input.from);
  const subject = input.subject ?? '';
  return SENDER_RE.test(sender) && SUBJECT_RE.test(subject);
}

export function extractGmailVerificationUrl(input: GmailVerificationInput): string | null {
  const body = `${input.text ?? ''}\n${input.html ?? ''}`;
  const match = URL_RE.exec(body);
  return match ? match[0].replace(/&amp;/g, '&') : null;
}
