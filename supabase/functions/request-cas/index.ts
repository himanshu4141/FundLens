/**
 * request-cas — triggers CASParser's CAS Generator API to have KFintech
 * email a CAS statement directly to the user's registered email address.
 *
 * The user receives the CAS via email within 1-2 minutes and forwards it
 * to their inbound address. The PDF password is set to their PAN so our
 * cas-webhook can decrypt it automatically.
 *
 * Request body: { email: string }
 *   email — user's email registered with KFintech (may differ from auth email)
 *
 * Auth: Bearer JWT (Supabase user token).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CASPARSER_API_KEY = Deno.env.get('CASPARSER_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return Response.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = (body.email ?? '').trim();
  if (!email) {
    return Response.json({ error: 'email is required' }, { status: 400 });
  }

  // Look up user PAN (used as PDF password so cas-webhook can decrypt it)
  const { data: profile } = await supabase
    .from('user_profile')
    .select('pan')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile?.pan) {
    return Response.json(
      { error: 'PAN not configured. Please complete step 1 first.' },
      { status: 400 },
    );
  }

  if (!CASPARSER_API_KEY) {
    return Response.json({ error: 'CASPARSER_API_KEY not configured' }, { status: 500 });
  }

  // Request all-time history up to today
  const toDate = new Date().toISOString().slice(0, 10);

  const casRes = await fetch('https://api.casparser.in/v4/kfintech/generate', {
    method: 'POST',
    headers: {
      'x-api-key': CASPARSER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      pan_no: profile.pan,
      from_date: '2000-01-01',
      to_date: toDate,
      password: profile.pan, // PDF will be encrypted with PAN — matches cas-webhook decryption
    }),
  });

  if (!casRes.ok) {
    const body = await casRes.text();
    console.error('CASParser generate error', casRes.status, body);
    return Response.json(
      { error: 'Failed to request CAS. Please check the email address and try again.' },
      { status: 502 },
    );
  }

  // Persist the email so subsequent refreshes never need to ask again
  await supabase
    .from('user_profile')
    .update({ kfintech_email: email })
    .eq('user_id', user.id);

  return Response.json(
    { ok: true },
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  );
});
