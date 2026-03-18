/**
 * sync-index — fetches daily benchmark index values from Yahoo Finance
 * for all symbols in benchmark_mapping and upserts into index_history.
 *
 * Schedule: "30 13 * * 1-5"  (1:30 PM UTC = 7 PM IST, weekdays)
 *
 * Yahoo Finance chart API returns:
 *   result[0].timestamp[]  — Unix timestamps
 *   result[0].indicators.quote[0].close[]  — closing prices
 *
 * Note: TRI (Total Return Index) data is not available via Yahoo Finance.
 * This fetches price index data as an approximation. For accurate XIRR,
 * the absolute benchmark return matters more than TRI vs price index difference.
 *
 * Symbols that may have limited/no data are silently skipped (logged in errors[]).
 */

import { createServiceClient } from '../_shared/supabase-client.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, { ...init, headers: { ...CORS, ...(init?.headers ?? {}) } });
}

const BATCH_SIZE = 500;
const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

// Map our internal symbols to Yahoo Finance query symbols
// Some CRISIL/custom symbols have no YF equivalent — they are skipped
const YF_SYMBOL_MAP: Record<string, string> = {
  '^NSEI': '^NSEI',        // Nifty 50
  '^CNX100': '^CNX100',    // Nifty 100
  '^NIFTY100': '^CNX100',
  '^NIFTY500': '^CNX500',
  '^NIFTYMIDCAP150': '^NIFMDCP150',
  '^NIFTYSMALLCAP250': '^CNXSC',
  '^NIFTYLMI250': '^NIFTY_LMI250.NS',
  '^NIFTYHYBRID6535': '^NIFTYHYBRID6535.NS',
  '^NIFTYARB': '^NIFTYARB.NS',
  '^NIFTY1D': null,           // No YF equivalent, skip
  '^NIFTYLIQUID': null,       // No YF equivalent, skip
  // CRISIL indices — not on Yahoo Finance
  'CRISILUST': null,
  'CRISILLD': null,
  'CRISILSD': null,
  'CRISILMD': null,
  'CRISILLONG': null,
  'CRISILDG': null,
  'CRISILHYBRID2575': null,
} as const;

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  console.log('[sync-index] invoked, method=%s', req.method);

  const supabase = createServiceClient();

  // Get all distinct symbols from benchmark_mapping
  const { data: mappings, error: mappingsError } = await supabase
    .from('benchmark_mapping')
    .select('benchmark_index_symbol, benchmark_index')
    .order('benchmark_index_symbol');

  if (mappingsError) {
    console.error('[sync-index] failed to fetch benchmark_mapping:', mappingsError.message);
    return Response.json({ success: false, error: mappingsError.message }, { status: 500 });
  }

  // Deduplicate symbols
  const symbolMap = new Map<string, string>();
  for (const m of mappings ?? []) {
    symbolMap.set(m.benchmark_index_symbol, m.benchmark_index);
  }

  console.log('[sync-index] %d distinct benchmark symbols to sync', symbolMap.size);

  let totalUpserted = 0;
  const errors: string[] = [];
  const skipped: string[] = [];

  for (const [symbol, indexName] of symbolMap) {
    // Look up Yahoo Finance symbol — null means skip
    const yfSymbol = symbol in YF_SYMBOL_MAP ? YF_SYMBOL_MAP[symbol as keyof typeof YF_SYMBOL_MAP] : symbol;

    if (yfSymbol === null) {
      console.log('[sync-index] %s: no Yahoo Finance equivalent, skipping', symbol);
      skipped.push(symbol);
      continue;
    }

    try {
      const url = `${YF_BASE}/${encodeURIComponent(yfSymbol)}?interval=1d&range=max`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        console.warn('[sync-index] %s (%s): HTTP %d', symbol, yfSymbol, res.status);
        errors.push(`${symbol} (${yfSymbol}): HTTP ${res.status}`);
        continue;
      }

      const json = await res.json();
      const result = json?.chart?.result?.[0];

      if (!result) {
        console.warn('[sync-index] %s: no chart result in Yahoo Finance response', symbol);
        errors.push(`${symbol}: no chart result in response`);
        continue;
      }

      const timestamps: number[] = result.timestamp ?? [];
      const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

      if (timestamps.length === 0) {
        console.warn('[sync-index] %s: no timestamp data', symbol);
        errors.push(`${symbol}: no timestamp data`);
        continue;
      }

      const rows = timestamps
        .map((ts, i) => {
          const close = closes[i];
          if (close === null || close === undefined || isNaN(close)) return null;
          const date = new Date(ts * 1000).toISOString().split('T')[0];
          return {
            index_symbol: symbol,
            index_name: indexName,
            index_date: date,
            close_value: close,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      let symbolUpserted = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('index_history')
          .upsert(batch, { onConflict: 'index_symbol,index_date', ignoreDuplicates: true });

        if (error) throw new Error(error.message);
        symbolUpserted += batch.length;
        totalUpserted += batch.length;
      }
      console.log('[sync-index] %s: upserted %d rows', symbol, symbolUpserted);
    } catch (err) {
      console.error('[sync-index] %s error:', symbol, (err as Error).message);
      errors.push(`${symbol}: ${(err as Error).message}`);
    }
  }

  console.log(
    '[sync-index] done — processed=%d, skipped=%d, rows=%d, errors=%d',
    symbolMap.size - skipped.length, skipped.length, totalUpserted, errors.length,
  );

  return Response.json({
    success: true,
    symbolsProcessed: symbolMap.size - skipped.length,
    symbolsSkipped: skipped,
    indexRowsUpserted: totalUpserted,
    errors,
  });
});
