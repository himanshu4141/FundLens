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
 * 3. For each file URL: download raw PDF → POST to CASParser /v4/smart/parse.
 * 4. Import parsed mutual funds and transactions.
 * 5. Always return HTTP 200 so CASParser does not retry on transient errors.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
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
    return Response.json({ error: 'Missing reference' }, { status: 400 });
  }

  const files = payload.files ?? [];
  if (files.length === 0) {
    console.warn('No files in payload for user', userId);
    return Response.json({ ok: true, message: 'No files to process' });
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
    return Response.json({ ok: false, error: 'user PAN not configured' });
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
    return Response.json({ error: 'DB error' }, { status: 500 });
  }

  const importId = importRecord.id as string;
  let totalFunds = 0;
  let totalTransactions = 0;
  const allErrors: string[] = [];

  for (const file of files) {
    try {
      // Download raw PDF bytes from CASParser presigned URL
      const fileRes = await fetch(file.url);
      if (!fileRes.ok) {
        throw new Error(`Download failed: ${fileRes.status} ${fileRes.statusText}`);
      }
      const fileBytes = await fileRes.arrayBuffer();

      // POST to CASParser smart/parse — PAN is the CAS PDF password
      const form = new FormData();
      form.append('file', new Blob([fileBytes], { type: 'application/pdf' }), 'cas.pdf');
      form.append('password', profile.pan);

      const parseRes = await fetch('https://api.casparser.in/v4/smart/parse', {
        method: 'POST',
        headers: { 'x-api-key': CASPARSER_API_KEY },
        body: form,
      });

      if (!parseRes.ok) {
        const body = await parseRes.text();
        throw new Error(`CASParser parse failed: ${parseRes.status} ${body}`);
      }

      const parsed = await parseRes.json();
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

  return Response.json({ ok: true, funds: totalFunds, transactions: totalTransactions });
});
