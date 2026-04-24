/**
 * parse-cas-pdf — accepts a CAS PDF uploaded directly from the app,
 * forwards it to the Vercel Python CAS parser, and imports the result.
 *
 * Request: binary PDF body
 *
 * Auth: Bearer JWT in Authorization header (Supabase user token).
 */

import { CORS, json } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';
import { importCASData, type CASParseResult } from '../_shared/import-cas.ts';

const LOCAL_CAS_PARSER_URL = Deno.env.get('LOCAL_CAS_PARSER_URL') ?? '';
const CAS_PARSER_SHARED_SECRET = Deno.env.get('CAS_PARSER_SHARED_SECRET') ?? '';
const VERCEL_PROTECTION_BYPASS_TOKEN = Deno.env.get('VERCEL_PROTECTION_BYPASS_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function resolveParserUrl(req: Request): string {
  // Prefer explicit env configuration when available. This keeps parser routing
  // stable across mobile/web/preview clients and avoids accidental calls to a
  // preview host that may not have parser secrets configured.
  if (LOCAL_CAS_PARSER_URL) {
    return LOCAL_CAS_PARSER_URL;
  }

  const origin = req.headers.get('origin');
  if (origin && /^https?:\/\//.test(origin)) {
    return new URL('/api/parse-cas-pdf', origin).toString();
  }

  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return new URL('/api/parse-cas-pdf', refererUrl.origin).toString();
    } catch {
      // ignore malformed referer and fall through to env-based URL
    }
  }

  return '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  // Authenticate user inside the function. This endpoint is deployed with
  // `--no-verify-jwt` because the Supabase Functions gateway rejects the
  // project's current user tokens, while `supabase.auth.getUser()` succeeds.
  const { user, supabase, error: authError } = await getUserFromRequest(req);
  if (authError || !user || !supabase) {
    return json({ error: authError ?? 'Unauthorized' }, { status: 401 });
  }

  // Read raw PDF binary from request body.
  // Client sends the file as a Blob body (not multipart form) so that
  // supabase.functions.invoke can attach the JWT auth header reliably.
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

  let parsed: CASParseResult;
  try {
    const parserUrl = resolveParserUrl(req);
    if (!parserUrl) {
      throw new Error('CAS parser URL is not configured');
    }
    if (!CAS_PARSER_SHARED_SECRET) {
      throw new Error('CAS parser secret is not configured');
    }

    const parserRes = await fetch(parserUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-file-name': fileName,
        'x-password': password,
        'x-parser-secret': CAS_PARSER_SHARED_SECRET,
        ...(VERCEL_PROTECTION_BYPASS_TOKEN
          ? { 'x-vercel-protection-bypass': VERCEL_PROTECTION_BYPASS_TOKEN }
          : {}),
      },
      body: pdfBytesRaw,
    });

    const parserBody = await parserRes.json().catch(() => ({})) as {
      error?: string;
      mutual_funds?: unknown[];
    };

    if (!parserRes.ok) {
      throw new Error(parserBody.error ?? `Parser request failed with status ${parserRes.status}`);
    }

    parsed = parserBody as CASParseResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[parse-cas-pdf] parser error: %s', msg);

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

  const parsedFolios = parsed?.mutual_funds ?? [];
  console.log('[parse-cas-pdf] parser returned %d folios', parsedFolios.length);

  if (parsedFolios.length === 0) {
    const msg = 'No mutual fund data found in this CAS PDF';
    await supabase
      .from('cas_import')
      .update({ import_status: 'failed', error_message: msg })
      .eq('id', importId);

    return json(
      {
        error: 'We could not find any mutual fund entries in this PDF. Please upload a detailed CAS statement.',
      },
      { status: 422 },
    );
  }

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

  if (fundsUpdated > 0) {
    const headers = { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };

    console.log('[parse-cas-pdf] triggering sync-nav in background');
    fetch(`${SUPABASE_URL}/functions/v1/sync-nav`, {
      method: 'POST',
      headers,
    }).catch((err) => console.error('[parse-cas-pdf] sync-nav trigger failed:', err));

    console.log('[parse-cas-pdf] triggering sync-index in background');
    fetch(`${SUPABASE_URL}/functions/v1/sync-index`, {
      method: 'POST',
      headers,
    }).catch((err) => console.error('[parse-cas-pdf] sync-index trigger failed:', err));
  }

  return json({ ok: true, funds: fundsUpdated, transactions: transactionsAdded });
});
