/**
 * sync-fund-meta — fetches expense ratio, AUM, min SIP for each active fund
 * from MFAPI (for ISIN) and mf.captnemo.in (for fund meta).
 *
 * Run on-demand after new fund imports. Deploy with --no-verify-jwt.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Delay helper — avoids hammering public APIs */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (_req) => {
  console.log('[sync-fund-meta] invocation started');

  const { data: funds, error: fundsError } = await supabase
    .from('fund')
    .select('id, scheme_code')
    .eq('is_active', true);

  if (fundsError) {
    console.error('[sync-fund-meta] failed to load funds:', fundsError.message);
    return new Response(JSON.stringify({ error: fundsError.message }), { status: 500 });
  }

  if (!funds?.length) {
    console.log('[sync-fund-meta] no active funds found');
    return new Response(JSON.stringify({ updated: 0 }), { status: 200 });
  }

  console.log(`[sync-fund-meta] processing ${funds.length} active funds`);

  let updated = 0;
  let failed = 0;

  for (const fund of funds) {
    await delay(200); // rate-limit between funds

    try {
      // Step 1: fetch ISIN from MFAPI
      const mfapiRes = await fetch(`https://api.mfapi.in/mf/${fund.scheme_code}`);
      if (!mfapiRes.ok) {
        console.warn(`[sync-fund-meta] scheme ${fund.scheme_code}: MFAPI ${mfapiRes.status}`);
        failed++;
        continue;
      }
      const mfapiData = await mfapiRes.json();
      const isin: string | null = mfapiData?.meta?.isin_growth ?? null;

      if (!isin) {
        console.warn(`[sync-fund-meta] scheme ${fund.scheme_code}: no ISIN in MFAPI response`);
        failed++;
        continue;
      }

      // Step 2: fetch meta from Kuvera API
      const kuveraRes = await fetch(`https://mf.captnemo.in/kuvera/${isin}`);
      if (!kuveraRes.ok) {
        console.warn(`[sync-fund-meta] scheme ${fund.scheme_code}: Kuvera ${kuveraRes.status}`);
        // Still save the ISIN even if Kuvera fails
        await supabase.from('fund').update({ isin }).eq('id', fund.id);
        failed++;
        continue;
      }
      // Response is an array; first element is the fund scheme
      const kuveraRaw = await kuveraRes.json();
      const kuveraData = Array.isArray(kuveraRaw) ? kuveraRaw[0] : kuveraRaw;

      // expense_ratio comes as a string e.g. "0.70"; aum is in lakhs; sip_min is rupees
      const expense_ratio: number | null =
        kuveraData?.expense_ratio != null ? parseFloat(kuveraData.expense_ratio) : null;
      const aum_cr: number | null =
        kuveraData?.aum != null ? Math.round(kuveraData.aum / 100) : null; // lakhs → crores
      const min_sip_amount: number | null =
        kuveraData?.sip_min != null ? Math.round(kuveraData.sip_min) : null;

      const { error: updateError } = await supabase
        .from('fund')
        .update({
          isin,
          expense_ratio,
          aum_cr,
          min_sip_amount,
          fund_meta_synced_at: new Date().toISOString(),
        })
        .eq('id', fund.id);

      if (updateError) {
        console.error(`[sync-fund-meta] scheme ${fund.scheme_code}: update error:`, updateError.message);
        failed++;
      } else {
        console.log(`[sync-fund-meta] scheme ${fund.scheme_code}: updated (isin=${isin}, er=${expense_ratio}, aum=${aum_cr}cr, minsip=${min_sip_amount})`);
        updated++;
      }
    } catch (err) {
      console.error(`[sync-fund-meta] scheme ${fund.scheme_code}: unexpected error:`, String(err));
      failed++;
    }
  }

  console.log(`[sync-fund-meta] done — updated=${updated} failed=${failed}`);
  return new Response(JSON.stringify({ updated, failed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
