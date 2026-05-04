/**
 * cas-webhook-resend — receives an inbound email from Resend Inbound Routes
 * and imports any CAS PDF attachments for the addressed user.
 *
 * Flow:
 *   1. Verify the Svix signature Resend attaches to every webhook (rejects spoofs)
 *   2. Parse the `to` header to extract the user's `cas+<token>@foliolens.in`
 *   3. Resolve the user via `user_profile.cas_inbox_token`
 *   4. For each PDF attachment, decode base64 and POST to the existing Vercel
 *      Python parser at `${APP_BASE_URL}/api/parse-cas-pdf` with the user's PAN
 *      (and a CDSL/NSDL fallback password from PAN+DOB)
 *   5. Run the shared `importCASData` helper to upsert funds and transactions
 *   6. Insert a `cas_import` audit row with status + counts + errors
 *   7. Always return 200 so Resend doesn't retry on user-side errors
 *
 * Deploy with `--no-verify-jwt` (Resend cannot send a Supabase JWT).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { decodeBase64 } from 'jsr:@std/encoding/base64';
import { importCASData, type CASParseResult } from '../_shared/import-cas.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_INBOUND_SECRET = Deno.env.get('RESEND_INBOUND_SECRET') ?? '';
const CAS_PARSER_SHARED_SECRET = Deno.env.get('CAS_PARSER_SHARED_SECRET') ?? '';
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://app.foliolens.in';
const VERCEL_PROTECTION_BYPASS_TOKEN = Deno.env.get('VERCEL_PROTECTION_BYPASS_TOKEN') ?? '';

const INBOX_DOMAIN = 'foliolens.in';
// Alphabet matches the SQL generator: A–Z minus I, L, O; 2–9.
const TOKEN_REGEX = /^[A-HJKMNP-Z2-9]{8}$/;
const TOKEN_EXTRACT_RE = new RegExp(`cas\\+([A-Za-z0-9]+)@${INBOX_DOMAIN.replace(/\./g, '\\.')}`, 'i');

// ── Token parsing (mirrors src/utils/casInboxToken.ts) ──────────────────────────

function parseInboxToken(toHeader: string | null | undefined): string | null {
  if (!toHeader) return null;
  const match = TOKEN_EXTRACT_RE.exec(toHeader);
  if (!match) return null;
  const candidate = match[1].toUpperCase();
  return TOKEN_REGEX.test(candidate) ? candidate : null;
}

// ── Resend signature verification ───────────────────────────────────────────────
//
// Resend signs inbound webhooks with the Svix protocol. Their docs spec is:
//   svix-id, svix-timestamp, svix-signature headers
//   signed payload = `${svix_id}.${svix_timestamp}.${raw_body}`
//   signature = base64( HMAC-SHA-256( payload, secret ) )
//   the svix-signature header lists `v1,<sig>` (multi-version, comma-separated)

async function verifyResendSignature(
  rawBody: string,
  headers: Headers,
): Promise<boolean> {
  if (!RESEND_INBOUND_SECRET) {
    console.warn('[cas-webhook-resend] RESEND_INBOUND_SECRET not set — refusing all requests');
    return false;
  }
  const svixId = headers.get('svix-id');
  const svixTimestamp = headers.get('svix-timestamp');
  const svixSignature = headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn('[cas-webhook-resend] missing svix-* signature headers');
    return false;
  }

  // Reject replays older than 5 minutes
  const tsSeconds = Number(svixTimestamp);
  if (!Number.isFinite(tsSeconds) || Math.abs(Date.now() / 1000 - tsSeconds) > 5 * 60) {
    console.warn('[cas-webhook-resend] svix-timestamp out of range, possible replay');
    return false;
  }

  // Resend's signing key has the form `whsec_<base64-secret>`.
  // Strip the prefix and decode before HMAC.
  const secret = RESEND_INBOUND_SECRET.startsWith('whsec_')
    ? RESEND_INBOUND_SECRET.slice('whsec_'.length)
    : RESEND_INBOUND_SECRET;

  let secretBytes: Uint8Array;
  try {
    secretBytes = decodeBase64(secret);
  } catch {
    secretBytes = new TextEncoder().encode(secret);
  }

  const payload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  // svix-signature is `v1,<sig> v1,<sig2> …` (space-separated for rotation)
  return svixSignature
    .split(' ')
    .map((entry) => entry.trim())
    .some((entry) => {
      const [version, value] = entry.split(',');
      return version === 'v1' && value === expected;
    });
}

// ── Email payload typing ────────────────────────────────────────────────────────

interface ResendInboundAttachment {
  filename?: string;
  contentType?: string;
  // Resend ships attachment bodies inline as base64 by default
  content?: string;
}

interface ResendInboundPayload {
  type?: string;
  data?: {
    from?: string | { email?: string; name?: string };
    to?: string | string[];
    subject?: string;
    headers?: Record<string, string>;
    attachments?: ResendInboundAttachment[];
  };
}

function getRecipientList(payload: ResendInboundPayload): string {
  const to = payload.data?.to;
  if (!to) return '';
  if (Array.isArray(to)) return to.join(', ');
  return to;
}

// ── Password derivation ─────────────────────────────────────────────────────────

function computeCdslPassword(pan: string, dob: string): string {
  // dob is ISO YYYY-MM-DD; CDSL/NSDL password is PAN + DDMMYYYY
  const [yyyy, mm, dd] = dob.split('-');
  return `${pan.toUpperCase()}${dd}${mm}${yyyy}`;
}

// ── Handler ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();

  if (!(await verifyResendSignature(rawBody, req.headers))) {
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: ResendInboundPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const recipients = getRecipientList(payload);
  const token = parseInboxToken(recipients);
  if (!token) {
    console.warn('[cas-webhook-resend] no inbox token in to=%s', recipients);
    // Return 200 — there's nothing the sender's mail server can do with retries
    return Response.json({ ok: false, reason: 'no_token' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: profile, error: profileError } = await supabase
    .from('user_profile')
    .select('user_id, pan, dob')
    .eq('cas_inbox_token', token)
    .maybeSingle();

  if (profileError) {
    console.error('[cas-webhook-resend] profile lookup error: %s', profileError.message);
    return Response.json({ ok: false, reason: 'lookup_failed' });
  }

  if (!profile?.user_id || !profile?.pan) {
    console.warn('[cas-webhook-resend] no profile for token=%s', token);
    return Response.json({ ok: false, reason: 'unknown_token' });
  }

  const userId = profile.user_id as string;
  const pan = profile.pan as string;
  const dob = (profile.dob as string | null) ?? null;

  const attachments = payload.data?.attachments ?? [];
  const pdfAttachments = attachments.filter(
    (att) =>
      att.contentType === 'application/pdf' ||
      att.filename?.toLowerCase().endsWith('.pdf'),
  );

  console.log(
    '[cas-webhook-resend] token=%s, user=%s, pdf_files=%d, total_files=%d',
    token,
    userId,
    pdfAttachments.length,
    attachments.length,
  );

  if (pdfAttachments.length === 0) {
    return Response.json({ ok: false, reason: 'no_pdfs' });
  }

  // Audit row
  const { data: importRecord, error: importError } = await supabase
    .from('cas_import')
    .insert({
      user_id: userId,
      import_source: 'email',
      import_status: 'pending',
      raw_payload: payload as unknown as Record<string, unknown>,
    })
    .select('id')
    .single();

  if (importError || !importRecord) {
    console.error('[cas-webhook-resend] cas_import insert failed: %s', importError?.message);
    return Response.json({ ok: false, reason: 'audit_failed' });
  }

  const importId = importRecord.id as string;
  let totalFunds = 0;
  let totalTransactions = 0;
  const allErrors: string[] = [];

  const cdslPassword = dob ? computeCdslPassword(pan, dob) : null;

  for (const attachment of pdfAttachments) {
    try {
      if (!attachment.content) {
        throw new Error('Empty attachment content');
      }
      const pdfBytes = decodeBase64(attachment.content);

      const parserHeaders: Record<string, string> = {
        'Content-Type': 'application/octet-stream',
        'x-file-name': attachment.filename ?? 'cas.pdf',
        'x-password': pan,
        'x-parser-secret': CAS_PARSER_SHARED_SECRET,
      };
      if (cdslPassword) parserHeaders['x-password-cdsl'] = cdslPassword;
      if (VERCEL_PROTECTION_BYPASS_TOKEN) {
        parserHeaders['x-vercel-protection-bypass'] = VERCEL_PROTECTION_BYPASS_TOKEN;
      }

      const parserRes = await fetch(`${APP_BASE_URL}/api/parse-cas-pdf`, {
        method: 'POST',
        headers: parserHeaders,
        body: pdfBytes,
      });

      const parserBody = (await parserRes.json().catch(() => ({}))) as
        | (CASParseResult & { error?: string })
        | { error?: string };

      if (!parserRes.ok) {
        throw new Error(
          (parserBody as { error?: string }).error ?? `Parser failed (${parserRes.status})`,
        );
      }

      const { fundsUpdated, transactionsAdded, errors } = await importCASData(
        supabase,
        userId,
        importId,
        parserBody as CASParseResult,
      );

      totalFunds += fundsUpdated;
      totalTransactions += transactionsAdded;
      allErrors.push(...errors);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cas-webhook-resend] attachment error: %s', msg);
      allErrors.push(msg);
    }
  }

  const status = allErrors.length > 0 && totalFunds === 0 ? 'failed' : 'success';

  await supabase
    .from('cas_import')
    .update({
      import_status: status,
      funds_updated: totalFunds,
      transactions_added: totalTransactions,
      error_message: allErrors.length > 0 ? allErrors.join('; ') : null,
    })
    .eq('id', importId);

  console.log(
    '[cas-webhook-resend] done, import_id=%s, status=%s, funds=%d, txns=%d, errors=%d',
    importId,
    status,
    totalFunds,
    totalTransactions,
    allErrors.length,
  );

  // Trigger sync-nav in the background so latest NAVs land without waiting for cron
  if (totalFunds > 0) {
    fetch(`${SUPABASE_URL}/functions/v1/sync-nav`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    }).catch((err) => console.error('[cas-webhook-resend] sync-nav trigger failed:', err));
  }

  return Response.json({ ok: true, funds: totalFunds, transactions: totalTransactions });
});
