/**
 * cas-webhook — receives CASParser inbound-email webhook.
 *
 * CASParser payload shape:
 * {
 *   inbound_email_id: string,
 *   reference: string,        // ← user UUID we passed at session creation
 *   forwarded_by: string,
 *   files: [{ url: string, cas_type?: string, expires_in: number }]
 * }
 *
 * Steps:
 * 1. Identify user from `reference` field.
 * 2. Look up user PAN from user_profile (needed to decrypt CAS PDF).
 * 3. For each file: pass its presigned URL directly to CASParser /v4/smart/parse
 *    (URL-based parsing — no need to download and re-upload the PDF).
 * 4. Import parsed mutual funds and transactions.
 * 5. Always return HTTP 200 so CASParser does not retry on transient errors.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { json } from '../_shared/cors.ts';
import { importCASData } from '../_shared/import-cas.ts';
import { decodeBase64 } from "jsr:@std/encoding/base64";

const CAS_PARSER_SHARED_SECRET = Deno.env.get('CAS_PARSER_SHARED_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: {
    headers?: { from?: string };
    attachments?: { file_name?: string; content?: string; content_type?: string }[];
  };

  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Identity user from sender email
  const fromHeader = payload.headers?.from || '';
  const emailMatch = fromHeader.match(/<([^>]+)>/);
  const senderEmail = (emailMatch ? emailMatch[1] : fromHeader).trim().toLowerCase();

  if (!senderEmail) {
    console.error('[cas-webhook] missing From header in payload');
    return json({ error: 'Missing From header' }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Look up user by kfintech_email
  const { data: profile } = await supabase
    .from('user_profile')
    .select('user_id, pan, cas_password')
    .ilike('kfintech_email', senderEmail)
    .maybeSingle();

  if (!profile?.user_id || !profile?.pan) {
    console.error('[cas-webhook] no active profile or missing PAN found for sender %s', senderEmail);
    return json({ ok: false, error: `Unknown sender email (${senderEmail}) or missing PAN` }, { status: 404 });
  }

  const userId = profile.user_id;

  const files = payload.attachments ?? [];
  const pdfFiles = files.filter(f => f.file_name?.toLowerCase().endsWith('.pdf') || f.content_type === 'application/pdf');

  console.log(
    '[cas-webhook] received, From=%s, user=%s, pdf_files=%d',
    senderEmail, userId, pdfFiles.length,
  );

  if (pdfFiles.length === 0) {
    console.warn('[cas-webhook] no PDF attachments in payload for user %s', userId);
    return json({ ok: false, message: `No PDF attachments to process (found ${files.length} total files)` }, { status: 400 });
  }

  // Create audit record
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
    console.error('[cas-webhook] failed to create cas_import record:', importError?.message);
    return json({ error: 'DB error' }, { status: 500 });
  }

  const importId = importRecord.id as string;
  console.log('[cas-webhook] import record created, import_id=%s', importId);

  let totalFunds = 0;
  let totalTransactions = 0;
  const allErrors: string[] = [];

  for (const file of pdfFiles) {
    try {
      if (!file.content) {
        throw new Error("Empty attachment content");
      }
      
      const pdfBytes = decodeBase64(file.content);
      const appUrl = Deno.env.get('EXPO_PUBLIC_APP_URL') ?? 'https://fund-lens.vercel.app';

      // POST to our Vercel Python parsing endpoint
      const parseRes = await fetch(`${appUrl}/api/parse-cas-pdf`, {
        method: 'POST',
        headers: { 
          'x-parser-secret': CAS_PARSER_SHARED_SECRET, 
          'x-password': profile.pan,
          'Content-Length': pdfBytes.length.toString(),
        },
        body: pdfBytes,
      });

      if (!parseRes.ok) {
        const errBody = await parseRes.text();
        throw new Error(`Parse failed: ${parseRes.status} ${errBody}`);
      }

      const parsed = await parseRes.json();
      console.log('[cas-webhook] Vercel parser parsed %d folios', (parsed?.mutual_funds ?? []).length);

      const { fundsUpdated, transactionsAdded, errors } = await importCASData(
        supabase, userId, importId, parsed,
      );

      totalFunds += fundsUpdated;
      totalTransactions += transactionsAdded;
      allErrors.push(...errors);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cas-webhook] file processing error:', msg);
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
    '[cas-webhook] done, import_id=%s, status=%s, funds=%d, txns=%d, errors=%d',
    importId, status, totalFunds, totalTransactions, allErrors.length,
  );

  // After a successful import, trigger sync-nav in the background so NAV data
  // is populated immediately without waiting for the daily cron job.
  if (totalFunds > 0) {
    console.log('[cas-webhook] triggering sync-nav in background for %d new funds', totalFunds);
    const syncNavUrl = `${SUPABASE_URL}/functions/v1/sync-nav`;
    fetch(syncNavUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    }).catch((err) => console.error('[cas-webhook] sync-nav trigger failed:', err));
  }

  return json({ ok: true, funds: totalFunds, transactions: totalTransactions });
});
