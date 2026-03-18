/**
 * cas-webhook — receives CAS JSON payload from CASParser.in
 * and imports funds + transactions into the user's account.
 *
 * Webhook URL (configure in CASParser.in):
 *   https://<project>.supabase.co/functions/v1/cas-webhook?token=<user-webhook-token>
 *
 * CASParser.in payload shape (simplified):
 * {
 *   investor_info: { name: string, email: string, mobile: string },
 *   folios: [{
 *     folio: string,
 *     schemes: [{
 *       scheme: string,            // scheme name
 *       isin: string,
 *       amfi: string,              // scheme code (AMFI number = mfapi scheme_code)
 *       advisor: string,
 *       rta_code: string,
 *       type: string,              // scheme category
 *       transactions: [{
 *         date: string,            // "DD-MMM-YYYY"
 *         description: string,
 *         amount: number,
 *         units: number,
 *         nav: number,
 *         balance: number,
 *         type: "purchase"|"redemption"|"switch_in"|"switch_out"|"dividend_reinvest"
 *       }]
 *     }]
 *   }]
 * }
 */

import { createServiceClient } from '../_shared/supabase-client.ts';

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function parseCasDate(dateStr: string): string {
  // "17-Mar-2026" → "2026-03-17"
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [day, month, year] = parts;
  const mm = MONTHS[month] ?? '01';
  return `${year}-${mm}-${day.padStart(2, '0')}`;
}

function normalizeTxType(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('redempt') || lower.includes('withdrawal')) return 'redemption';
  if (lower.includes('switch out')) return 'switch_out';
  if (lower.includes('switch in')) return 'switch_in';
  if (lower.includes('dividend reinvest') || lower.includes('div reinv')) return 'dividend_reinvest';
  return 'purchase';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return Response.json({ error: 'Missing token parameter' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Resolve user from webhook token
  const { data: tokenRow, error: tokenError } = await supabase
    .from('webhook_token')
    .select('user_id')
    .eq('token', token)
    .single();

  if (tokenError || !tokenRow) {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }

  const userId = tokenRow.user_id as string;

  // Parse payload
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Create import audit record
  const { data: importRecord, error: importError } = await supabase
    .from('cas_import')
    .insert({
      user_id: userId,
      import_source: 'email',
      import_status: 'pending',
      raw_payload: payload,
    })
    .select('id')
    .single();

  if (importError || !importRecord) {
    return Response.json({ error: 'Failed to create import record' }, { status: 500 });
  }

  const importId = importRecord.id as string;

  let fundsUpdated = 0;
  let transactionsAdded = 0;
  let errorMessage: string | null = null;

  try {
    const folios = (payload.folios as unknown[]) ?? [];

    // Get benchmark mapping for category lookup
    const { data: benchmarks } = await supabase
      .from('benchmark_mapping')
      .select('scheme_category, benchmark_index, benchmark_index_symbol');

    const benchmarkMap = new Map<string, { index: string; symbol: string }>();
    for (const b of benchmarks ?? []) {
      const bm = b as { scheme_category: string; benchmark_index: string; benchmark_index_symbol: string };
      benchmarkMap.set(bm.scheme_category, {
        index: bm.benchmark_index,
        symbol: bm.benchmark_index_symbol,
      });
    }

    for (const folioRaw of folios) {
      const folio = folioRaw as { folio: string; schemes: unknown[] };
      const folioNumber = folio.folio ?? null;

      for (const schemeRaw of folio.schemes ?? []) {
        const scheme = schemeRaw as {
          scheme: string;
          amfi: string;
          type: string;
          transactions: unknown[];
        };

        const schemeCode = parseInt(scheme.amfi ?? '0', 10);
        if (isNaN(schemeCode) || schemeCode === 0) continue;

        const schemeName = scheme.scheme ?? 'Unknown Fund';
        const schemeCategory = scheme.type ?? 'Flexi Cap Fund';
        const bm = benchmarkMap.get(schemeCategory) ?? benchmarkMap.get('Flexi Cap Fund');

        // Upsert fund
        const { data: fundRow, error: fundError } = await supabase
          .from('fund')
          .upsert(
            {
              user_id: userId,
              scheme_code: schemeCode,
              scheme_name: schemeName,
              scheme_category: schemeCategory,
              benchmark_index: bm?.index ?? null,
              benchmark_index_symbol: bm?.symbol ?? null,
              is_active: true,
            },
            { onConflict: 'user_id,scheme_code' },
          )
          .select('id')
          .single();

        if (fundError || !fundRow) continue;
        fundsUpdated++;

        const fundId = fundRow.id as string;

        // Insert transactions (skip duplicates via unique constraint)
        const txRows = (scheme.transactions ?? [])
          .map((txRaw) => {
            const tx = txRaw as {
              date: string;
              type?: string;
              description?: string;
              amount: number;
              units: number;
              nav: number;
            };
            const txType = normalizeTxType(tx.type ?? tx.description ?? 'purchase');
            return {
              user_id: userId,
              fund_id: fundId,
              transaction_date: parseCasDate(tx.date),
              transaction_type: txType,
              units: Math.abs(tx.units ?? 0),
              nav_at_transaction: tx.nav ?? 0,
              amount: Math.abs(tx.amount ?? 0),
              folio_number: folioNumber,
              cas_import_id: importId,
            };
          })
          .filter((tx) => tx.units > 0);

        if (txRows.length > 0) {
          const { error: txError, count } = await supabase
            .from('transaction')
            .upsert(txRows, {
              onConflict: 'fund_id,transaction_date,transaction_type,units,amount',
              ignoreDuplicates: true,
              count: 'exact',
            });

          if (!txError) transactionsAdded += count ?? txRows.length;
        }
      }
    }
  } catch (err) {
    errorMessage = (err as Error).message;
  }

  // Update import record
  await supabase
    .from('cas_import')
    .update({
      import_status: errorMessage ? 'failed' : 'success',
      funds_updated: fundsUpdated,
      transactions_added: transactionsAdded,
      error_message: errorMessage,
    })
    .eq('id', importId);

  if (errorMessage) {
    return Response.json({ success: false, error: errorMessage }, { status: 500 });
  }

  return Response.json({ success: true, fundsUpdated, transactionsAdded });
});
