/**
 * sync-index — fetches daily benchmark index values from Yahoo Finance (primary)
 * and EODHD (fallback) for all symbols in benchmark_mapping, then upserts
 * into index_history.
 *
 * Schedule: "30 13 * * 1-5"  (1:30 PM UTC = 7 PM IST, weekdays)
 *
 * Yahoo Finance chart API:
 *   Uses period1/period2 (NOT range=max). range=max silently returns monthly
 *   data for long date ranges — explicit epoch params force true daily granularity.
 *
 * EODHD API (fallback):
 *   Used for indices not available on Yahoo Finance. Requires EODHD_API_KEY secret.
 *   Free tier: 20 calls/day, full history per symbol.
 *   If EODHD_API_KEY is unset, EODHD step is silently skipped.
 *
 * Symbols that cannot be sourced anywhere are logged in errors[] and skipped.
 */

import { createServiceClient } from '../_shared/supabase-client.ts';
import { json } from '../_shared/cors.ts';

const BATCH_SIZE = 500;
const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const EODHD_BASE = 'https://eodhd.com/api/eod';

// ---------------------------------------------------------------------------
// Symbol maps
// ---------------------------------------------------------------------------

// Primary source: Yahoo Finance
// null = symbol not available on Yahoo Finance → try EODHD
const YF_SYMBOL_MAP: Record<string, string | null> = {
  '^NSEI':             '^NSEI',        // Nifty 50
  '^NSEBANK':          '^NSEBANK',     // Nifty Bank
  '^BSESN':            '^BSESN',       // BSE Sensex
  '^CNXIT':            '^CNXIT',       // Nifty IT
  '^CNX100':           '^CNX100',      // Nifty 100 (direct)
  '^NIFTY100':         '^CNX100',      // Nifty 100 (via fund category mapping)
  '^NIFTYMIDCAP150':   '^NSEMDCP150',  // Nifty Midcap 150 — fallback to EODHD if < 50 rows
  '^NIFTYSMALLCAP250': '^NSEMDCP250',  // Nifty Smallcap 250 — fallback to EODHD if < 50 rows
  '^BSE100':           '^BSE100',      // BSE 100 — fallback to EODHD if < 50 rows
  '^BSE500':           '^BSE500',      // BSE 500 — fallback to EODHD if < 50 rows
  '^NIFTY500':         null,           // Not on Yahoo Finance → EODHD
  '^NIFTYLMI250':      null,           // Not on Yahoo Finance → EODHD
  '^BSENEXT50':        null,           // Not on Yahoo Finance → EODHD
  '^NIFTYHYBRID6535':  null,           // Not on Yahoo Finance or EODHD → skip
  '^NIFTYARB':         null,           // Not on Yahoo Finance or EODHD → skip
  '^NIFTY1D':          null,           // Rate index, no public source
  '^NIFTYLIQUID':      null,           // Rate index, no public source
  'CRISILUST':         null,           // Proprietary CRISIL data
  'CRISILLD':          null,
  'CRISILSD':          null,
  'CRISILMD':          null,
  'CRISILLONG':        null,
  'CRISILDG':          null,
  'CRISILHYBRID2575':  null,
};

// Fallback source: EODHD
// Only consulted when Yahoo Finance symbol is null OR returns < 50 rows.
const EODHD_SYMBOL_MAP: Record<string, string> = {
  '^NIFTY500':          'NIFTY500.INDX',
  '^NIFTYLMI250':       'NIFTYLARGMID250.INDX',
  '^NIFTYMIDCAP150':    'NIFTYMIDCAP150.INDX',
  '^NIFTYSMALLCAP250':  'NIFTYSMLCAP250.INDX',
  '^BSE100':            'BSE100.INDX',
  '^BSE500':            'BSE500.INDX',
  '^BSENEXT50':         'BSESENSEX_NEXT50.INDX',
};

// ---------------------------------------------------------------------------
// EODHD fetch helper
// ---------------------------------------------------------------------------

async function fetchFromEODHD(
  eohdSymbol: string,
  apiKey: string,
): Promise<{ date: string; close: number }[]> {
  const url = `${EODHD_BASE}/${encodeURIComponent(eohdSymbol)}` +
    `?api_token=${apiKey}&fmt=json&from=2000-01-01&order=a`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`EODHD HTTP ${res.status} for ${eohdSymbol}`);
  const data = await res.json() as Array<{ date: string; close: number | null }>;
  return data.filter((r) => r.close !== null && !isNaN(r.close as number)) as { date: string; close: number }[];
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  console.log('[sync-index] invoked, method=%s', req.method);

  const supabase = createServiceClient();
  const eodhd_key = Deno.env.get('EODHD_API_KEY') ?? '';

  if (!eodhd_key) {
    console.warn('[sync-index] EODHD_API_KEY not set — EODHD fallback disabled');
  }

  // Get all distinct symbols from benchmark_mapping
  const { data: mappings, error: mappingsError } = await supabase
    .from('benchmark_mapping')
    .select('benchmark_index_symbol, benchmark_index')
    .order('benchmark_index_symbol');

  if (mappingsError) {
    console.error('[sync-index] failed to fetch benchmark_mapping:', mappingsError.message);
    return json({ success: false, error: mappingsError.message }, { status: 500 });
  }

  // Deduplicate symbols (multiple fund categories can share a symbol)
  const symbolMap = new Map<string, string>();
  for (const m of mappings ?? []) {
    symbolMap.set(m.benchmark_index_symbol, m.benchmark_index);
  }

  console.log('[sync-index] %d distinct benchmark symbols to sync', symbolMap.size);

  let totalUpserted = 0;
  const errors: string[] = [];
  const skipped: string[] = [];

  for (const [symbol, indexName] of symbolMap) {
    const yfSymbol = symbol in YF_SYMBOL_MAP ? YF_SYMBOL_MAP[symbol] : symbol;

    let rows: { index_symbol: string; index_name: string; index_date: string; close_value: number }[] = [];

    // ── Step 1: Try Yahoo Finance ──────────────────────────────────────────
    if (yfSymbol !== null && yfSymbol !== undefined) {
      try {
        const period2 = Math.floor(Date.now() / 1000);
        const period1 = 631152000; // 1990-01-01 UTC
        const url = `${YF_BASE}/${encodeURIComponent(yfSymbol)}?interval=1d&period1=${period1}&period2=${period2}`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        });

        if (res.ok) {
          const data = await res.json();
          const result = data?.chart?.result?.[0];
          if (result) {
            const timestamps: number[] = result.timestamp ?? [];
            const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
            rows = timestamps
              .map((ts: number, i: number) => {
                const close = closes[i];
                if (close === null || close === undefined || isNaN(close)) return null;
                return {
                  index_symbol: symbol,
                  index_name: indexName,
                  index_date: new Date(ts * 1000).toISOString().split('T')[0],
                  close_value: close,
                };
              })
              .filter((r): r is NonNullable<typeof r> => r !== null);
          }
        } else {
          console.warn('[sync-index] %s (%s): Yahoo Finance HTTP %d', symbol, yfSymbol, res.status);
        }
      } catch (err) {
        console.warn('[sync-index] %s: Yahoo Finance error: %s', symbol, (err as Error).message);
      }

      if (rows.length >= 50) {
        console.log('[sync-index] %s: Yahoo Finance → %d rows', symbol, rows.length);
      } else if (rows.length > 0) {
        console.warn('[sync-index] %s: Yahoo Finance returned only %d rows — trying EODHD', symbol, rows.length);
        rows = []; // discard sparse YF data; EODHD will fill completely
      }
    }

    // ── Step 2: Try EODHD (if YF skipped/failed/sparse and key available) ──
    if (rows.length === 0 && symbol in EODHD_SYMBOL_MAP) {
      if (!eodhd_key) {
        console.warn('[sync-index] %s: would use EODHD but EODHD_API_KEY not set', symbol);
        errors.push(`${symbol}: EODHD_API_KEY not configured`);
        continue;
      }
      const eohdSymbol = EODHD_SYMBOL_MAP[symbol];
      try {
        const eohdRows = await fetchFromEODHD(eohdSymbol, eodhd_key);
        rows = eohdRows.map((r) => ({
          index_symbol: symbol,
          index_name: indexName,
          index_date: r.date,
          close_value: r.close,
        }));
        console.log('[sync-index] %s: EODHD (%s) → %d rows', symbol, eohdSymbol, rows.length);
      } catch (err) {
        console.error('[sync-index] %s: EODHD error: %s', symbol, (err as Error).message);
        errors.push(`${symbol}: ${(err as Error).message}`);
        continue;
      }
    }

    // ── Step 3: Skip if both sources produced nothing ──────────────────────
    if (rows.length === 0) {
      if (yfSymbol === null && !(symbol in EODHD_SYMBOL_MAP)) {
        console.log('[sync-index] %s: no data source available, skipping', symbol);
        skipped.push(symbol);
      } else {
        console.warn('[sync-index] %s: no data returned from any source', symbol);
        errors.push(`${symbol}: no data from Yahoo Finance or EODHD`);
      }
      continue;
    }

    // ── Step 4: Upsert in batches ──────────────────────────────────────────
    try {
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
      console.error('[sync-index] %s upsert error:', symbol, (err as Error).message);
      errors.push(`${symbol}: ${(err as Error).message}`);
    }
  }

  console.log(
    '[sync-index] done — processed=%d, skipped=%d, rows=%d, errors=%d',
    symbolMap.size - skipped.length, skipped.length, totalUpserted, errors.length,
  );

  return json({
    success: true,
    symbolsProcessed: symbolMap.size - skipped.length,
    symbolsSkipped: skipped,
    indexRowsUpserted: totalUpserted,
    errors,
  });
});
