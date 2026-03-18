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

const CASPARSER_API_KEY = Deno.env.get('CASPARSER_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: {
    inbound_email_id?: string;
    reference?: string;
    forwarded_by?: string;
    files?: { url: string; cas_type?: string }[];
  };

  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const userId = payload.reference;
  if (!userId) {
    console.error('Missing reference in webhook payload');
    return json({ error: 'Missing reference' }, { status: 400 });
  }

  const files = payload.files ?? [];
  if (files.length === 0) {
    console.warn('No files in payload for user', userId);
    return json({ ok: true, message: 'No files to process' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Resolve user PAN
  const { data: profile } = await supabase
    .from('user_profile')
    .select('pan')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile?.pan) {
    console.error('No PAN configured for user', userId);
    // Return 200 so CASParser does not retry — this requires user action
    return json({ ok: false, error: 'user PAN not configured' });
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
    console.error('Failed to create cas_import', importError);
    return json({ error: 'DB error' }, { status: 500 });
  }

  const importId = importRecord.id as string;
  let totalFunds = 0;
  let totalTransactions = 0;
  const allErrors: string[] = [];

  for (const file of files) {
    try {
      // Pass the presigned URL directly to CASParser — no need to download and re-upload.
      // PAN is the CAS PDF password (KFintech and CAMS use plain PAN as password).
      const parseRes = await fetch('https://api.casparser.in/v4/smart/parse', {
        method: 'POST',
        headers: { 'x-api-key': CASPARSER_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_url: file.url, password: profile.pan }),
      });

      if (!parseRes.ok) {
        const errBody = await parseRes.text();
        throw new Error(`CASParser parse failed: ${parseRes.status} ${errBody}`);
      }

      const parsed = await parseRes.json();
      console.log('CASParser parse response: folios=%d', (parsed?.mutual_funds ?? []).length);

      const { fundsUpdated, transactionsAdded, errors } = await importCASData(
        supabase, userId, importId, parsed,
      );

      totalFunds += fundsUpdated;
      totalTransactions += transactionsAdded;
      allErrors.push(...errors);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('File processing error', msg);
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

  // After a successful import, trigger sync-nav in the background so NAV data
  // is populated immediately without waiting for the daily cron job.
  if (totalFunds > 0) {
    const syncNavUrl = `${SUPABASE_URL}/functions/v1/sync-nav`;
    fetch(syncNavUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    }).catch((err) => console.error('sync-nav trigger failed:', err));
  }

  return json({ ok: true, funds: totalFunds, transactions: totalTransactions });
});
