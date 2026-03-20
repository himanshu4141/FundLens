/**
 * parse-cas-pdf — accepts a CAS PDF uploaded directly from the app,
 * parses it locally (no external API), and imports the resulting transactions.
 *
 * Request: multipart/form-data
 *   - file: PDF blob
 *   - password (optional): CAS PDF password; falls back to user's stored PAN
 *
 * Auth: Bearer JWT in Authorization header (Supabase user token).
 */

import { CORS, json } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { importCASData, type CASParseResult } from '../_shared/import-cas.ts';
import { parseCasPdf } from '../_shared/parse-cas-pdf.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  // Authenticate user
  const { user, supabase, error: authError } = await getUserFromRequest(req);
  if (authError || !user || !supabase) {
    return json({ error: authError ?? 'Unauthorized' }, { status: 401 });
  }

  // Read raw PDF binary from request body.
  // Client sends the file as a Blob body (not multipart form) so that
  // supabase.functions.invoke can attach the JWT auth header reliably —
  // FormData bodies cause the SDK to silently drop the Authorization header.
  let pdfBytesRaw: ArrayBuffer;
  try {
    pdfBytesRaw = await req.arrayBuffer();
  } catch {
    return json({ error: 'Could not read request body' }, { status: 400 });
  }

  if (pdfBytesRaw.byteLength === 0) {
    return json({ error: 'Empty file received' }, { status: 400 });
  }

  const fileName = req.headers.get('x-file-name') ?? 'cas.pdf';

  // Password: always look up the stored PAN for this user
  const { data: profile } = await supabase
    .from('user_profile')
    .select('pan')
    .eq('user_id', user.id)
    .maybeSingle();

  const password = profile?.pan ?? '';

  console.log(
    '[parse-cas-pdf] user=%s, file=%s, size=%d bytes, password_source=pan',
    user.id, fileName, pdfBytesRaw.byteLength,
  );

  if (!password) {
    console.warn('[parse-cas-pdf] no password available for user %s', user.id);
    return json(
      { error: 'CAS PDF password required. Please set your PAN in the app settings.' },
      { status: 400 },
    );
  }

  // Create audit record
  const { data: importRecord, error: importError } = await supabase
    .from('cas_import')
    .insert({
      user_id: user.id,
      import_source: 'pdf',
      import_status: 'pending',
    })
    .select('id')
    .single();

  if (importError || !importRecord) {
    console.error('[parse-cas-pdf] failed to create import record:', importError?.message);
    return json({ error: 'Failed to create import record' }, { status: 500 });
  }

  const importId = importRecord.id as string;
  console.log('[parse-cas-pdf] import record created, import_id=%s', importId);

  // Parse PDF locally — no external API dependency.
  const pdfBytes = new Uint8Array(pdfBytesRaw);
  let parsed: CASParseResult;
  try {
    parsed = await parseCasPdf(pdfBytes, password);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[parse-cas-pdf] local parse error: %s', msg);

    await supabase
      .from('cas_import')
      .update({ import_status: 'failed', error_message: msg })
      .eq('id', importId);

    const isPasswordError = msg.toLowerCase().includes('password') || msg.toLowerCase().includes('decrypt');
    return json(
      {
        error: isPasswordError
          ? 'Wrong PDF password. Make sure your PAN is correct.'
          : 'Failed to parse CAS PDF. Please try again.',
      },
      { status: 422 },
    );
  }

  console.log('[parse-cas-pdf] local parser: %d folios', (parsed?.mutual_funds ?? []).length);

  const { fundsUpdated, transactionsAdded, errors } = await importCASData(
    supabase, user.id, importId, parsed,
  );

  const status = errors.length > 0 && fundsUpdated === 0 ? 'failed' : 'success';
  await supabase
    .from('cas_import')
    .update({
      import_status: status,
      funds_updated: fundsUpdated,
      transactions_added: transactionsAdded,
      error_message: errors.length > 0 ? errors.join('; ') : null,
    })
    .eq('id', importId);

  console.log(
    '[parse-cas-pdf] done, import_id=%s, status=%s, funds=%d, txns=%d, errors=%d',
    importId, status, fundsUpdated, transactionsAdded, errors.length,
  );

  return json({ ok: true, funds: fundsUpdated, transactions: transactionsAdded });
});
