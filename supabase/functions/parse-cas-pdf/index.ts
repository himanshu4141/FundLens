/**
 * parse-cas-pdf — accepts a CAS PDF uploaded directly from the app,
 * parses it via CASParser, and imports the resulting transactions.
 *
 * Request: multipart/form-data
 *   - file: PDF blob
 *   - password (optional): CAS PDF password; falls back to user's stored PAN
 *
 * Auth: Bearer JWT in Authorization header (Supabase user token).
 */

import { CORS, json } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { importCASData } from '../_shared/import-cas.ts';

const CASPARSER_API_KEY = Deno.env.get('CASPARSER_API_KEY') ?? '';

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

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const fileEntry = formData.get('file');
  if (!fileEntry || !(fileEntry instanceof File)) {
    return json({ error: 'Missing file field' }, { status: 400 });
  }

  // Password: use value from form if provided, else fall back to stored PAN
  let password = (formData.get('password') as string | null) ?? '';
  if (!password) {
    const { data: profile } = await supabase
      .from('user_profile')
      .select('pan')
      .eq('user_id', user.id)
      .maybeSingle();

    password = profile?.pan ?? '';
  }

  if (!password) {
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
    return json({ error: 'Failed to create import record' }, { status: 500 });
  }

  const importId = importRecord.id as string;

  // Forward to CASParser smart/parse
  const parseForm = new FormData();
  parseForm.append('file', fileEntry, 'cas.pdf');
  parseForm.append('password', password);

  const parseRes = await fetch('https://api.casparser.in/v4/smart/parse', {
    method: 'POST',
    headers: { 'x-api-key': CASPARSER_API_KEY },
    body: parseForm,
  });

  if (!parseRes.ok) {
    const body = await parseRes.text();
    console.error('CASParser parse error', parseRes.status, body);

    await supabase
      .from('cas_import')
      .update({ import_status: 'failed', error_message: `Parse failed: ${parseRes.status}` })
      .eq('id', importId);

    const isPasswordError = parseRes.status === 400 && body.toLowerCase().includes('password');
    return json(
      {
        error: isPasswordError
          ? 'Wrong PDF password. Make sure your PAN is correct.'
          : 'Failed to parse CAS PDF. Please try again.',
      },
      { status: 422 },
    );
  }

  const parsed = await parseRes.json();
  console.log('CASParser parse response: folios=%d', (parsed?.mutual_funds ?? []).length);

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

  return json({ ok: true, funds: fundsUpdated, transactions: transactionsAdded });
});
