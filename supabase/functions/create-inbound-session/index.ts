import { CORS, json } from '../_shared/cors.ts';
import { getUserFromRequest } from '../_shared/auth.ts';

const CASPARSER_API_KEY = Deno.env.get('CASPARSER_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';

// The URL CASParser will POST the processed file payload to.
const CAS_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/cas-webhook`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  // --- Auth ---
  const { user, supabase, error: authError } = await getUserFromRequest(req);
  if (authError || !user || !supabase) {
    return json({ error: authError ?? 'Unauthorized' }, { status: 401 });
  }

  console.log('[create-inbound-session] user=%s', user.id);

  if (!CASPARSER_API_KEY) {
    console.error('[create-inbound-session] CASPARSER_API_KEY not configured');
    return json({ error: 'CASPARSER_API_KEY not configured' }, { status: 500 });
  }

  // --- Call CASParser inbound email API ---
  console.log('[create-inbound-session] calling CASParser inbound-email API');
  const casRes = await fetch('https://api.casparser.in/v4/inbound-email', {
    method: 'POST',
    headers: {
      'x-api-key': CASPARSER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reference: user.id,
      callback_url: CAS_WEBHOOK_URL,
    }),
  });

  if (!casRes.ok) {
    const body = await casRes.text();
    console.error('[create-inbound-session] CASParser API error, status=%d, body=%s', casRes.status, body);
    return json({ error: 'Failed to create inbound email session' }, { status: 502 });
  }

  const casData = await casRes.json();

  // CASParser returns { inbound_email_id, email } — normalise field names defensively.
  const inboundEmailId: string = casData.inbound_email_id ?? casData.id ?? '';
  const inboundEmailAddress: string = casData.email ?? casData.inbound_email ?? '';

  if (!inboundEmailId || !inboundEmailAddress) {
    console.error('[create-inbound-session] unexpected CASParser response shape:', JSON.stringify(casData));
    return json({ error: 'Unexpected response from CASParser' }, { status: 502 });
  }

  // --- Upsert session row ---
  const { error: dbError } = await supabase.from('cas_inbound_session').upsert(
    {
      user_id: user.id,
      inbound_email_id: inboundEmailId,
      inbound_email_address: inboundEmailAddress,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (dbError) {
    console.error('[create-inbound-session] DB upsert error:', dbError.message);
    return json({ error: 'Failed to save session' }, { status: 500 });
  }

  console.log('[create-inbound-session] session created, email=%s', inboundEmailAddress);
  return json({ inboundEmail: inboundEmailAddress });
});
