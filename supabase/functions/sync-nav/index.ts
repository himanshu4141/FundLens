/**
 * sync-nav — fetches latest NAV data from mfapi.in for all active funds
 * and upserts into nav_history.
 *
 * Triggered via cron (daily ~7 PM IST) or HTTP POST with service role key.
 * Schedule: set in Supabase Dashboard → Edge Functions → sync-nav → Schedules
 *   Recommended: "30 13 * * 1-5"  (1:30 PM UTC = 7 PM IST, weekdays)
 *
 * mfapi.in format: { data: [{ date: "DD-MM-YYYY", nav: "123.45" }, ...] }
 */

import { createServiceClient } from '../_shared/supabase-client.ts';
import { json } from '../_shared/cors.ts';

const BATCH_SIZE = 500;
const MFAPI_BASE = 'https://api.mfapi.in/mf';

Deno.serve(async (req) => {
  // Allow scheduled invocations and authenticated HTTP calls
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  console.log('[sync-nav] invoked, method=%s', req.method);

  const supabase = createServiceClient();

  // Get all distinct active scheme_codes across all users
  const { data: funds, error: fundsError } = await supabase
    .from('fund')
    .select('scheme_code')
    .eq('is_active', true);

  if (fundsError) {
    console.error('[sync-nav] failed to fetch active funds:', fundsError.message);
    return Response.json({ success: false, error: fundsError.message }, { status: 500 });
  }

  const schemeCodes = [...new Set((funds ?? []).map((f) => f.scheme_code as number))];
  console.log('[sync-nav] %d distinct active scheme codes to sync', schemeCodes.length);

  if (schemeCodes.length === 0) {
    console.log('[sync-nav] no active funds — nothing to do');
    return Response.json({ success: true, message: 'No active funds to sync', navRowsUpserted: 0 });
  }

  let totalUpserted = 0;
  const errors: string[] = [];

  for (const schemeCode of schemeCodes) {
    try {
      const res = await fetch(`${MFAPI_BASE}/${schemeCode}`, {
        headers: { 'User-Agent': 'FundLens/1.0' },
      });

      if (!res.ok) {
        console.warn('[sync-nav] scheme %d: HTTP %d', schemeCode, res.status);
        errors.push(`scheme ${schemeCode}: HTTP ${res.status}`);
        continue;
      }

      const json = await res.json();
      const rawData = json.data as Array<{ date: string; nav: string }> | undefined;

      if (!rawData?.length) {
        console.warn('[sync-nav] scheme %d: empty response from mfapi', schemeCode);
        errors.push(`scheme ${schemeCode}: empty response`);
        continue;
      }

      // mfapi returns date as "DD-MM-YYYY" — convert to ISO "YYYY-MM-DD"
      const rows = rawData
        .map((d) => {
          const parts = d.date.split('-');
          if (parts.length !== 3) return null;
          const [day, month, year] = parts;
          const nav = parseFloat(d.nav);
          if (isNaN(nav)) return null;
          return { scheme_code: schemeCode, nav_date: `${year}-${month}-${day}`, nav };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      let schemeUpserted = 0;
      // Batch upsert — ignoreDuplicates avoids overwriting existing clean data
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('nav_history')
          .upsert(batch, { onConflict: 'scheme_code,nav_date', ignoreDuplicates: true });

        if (error) throw new Error(error.message);
        schemeUpserted += batch.length;
        totalUpserted += batch.length;
      }
      console.log('[sync-nav] scheme %d: upserted %d rows', schemeCode, schemeUpserted);
    } catch (err) {
      console.error('[sync-nav] scheme %d error:', schemeCode, (err as Error).message);
      errors.push(`scheme ${schemeCode}: ${(err as Error).message}`);
    }
  }

  console.log(
    '[sync-nav] done — schemes=%d, rows=%d, errors=%d',
    schemeCodes.length, totalUpserted, errors.length,
  );

  return Response.json({
    success: true,
    schemesProcessed: schemeCodes.length,
    navRowsUpserted: totalUpserted,
    errors,
  });
});
