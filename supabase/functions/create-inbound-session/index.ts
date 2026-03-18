import { createClient } from 'jsr:@supabase/supabase-js@2';

const CASPARSER_API_KEY = Deno.env.get('CASPARSER_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// The URL CASParser will POST the processed file payload to.
const CAS_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/cas-webhook`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  // --- Auth ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return Response.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const jwt = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(jwt);

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!CASPARSER_API_KEY) {
    return Response.json({ error: 'CASPARSER_API_KEY not configured' }, { status: 500 });
  }

  // --- Call CASParser inbound email API ---
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
    console.error('CASParser API error', casRes.status, body);
    return Response.json({ error: 'Failed to create inbound email session' }, { status: 502 });
  }

  const casData = await casRes.json();

  // CASParser returns { inbound_email_id, email } — normalise field names defensively.
  const inboundEmailId: string = casData.inbound_email_id ?? casData.id ?? '';
  const inboundEmailAddress: string = casData.email ?? casData.inbound_email ?? '';

  if (!inboundEmailId || !inboundEmailAddress) {
    console.error('Unexpected CASParser response shape', casData);
    return Response.json({ error: 'Unexpected response from CASParser' }, { status: 502 });
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
    console.error('DB upsert error', dbError);
    return Response.json({ error: 'Failed to save session' }, { status: 500 });
  }

  return Response.json(
    { inboundEmail: inboundEmailAddress },
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  );
});
