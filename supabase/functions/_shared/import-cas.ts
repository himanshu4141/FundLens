/**
 * Shared CAS import logic — used by both cas-webhook (inbound email)
 * and parse-cas-pdf (direct upload) edge functions.
 */

import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// CASParser smart/parse response types (subset we use)
export interface CASMutualFund {
  scheme: string;
  scheme_code: number;
  type?: string;         // scheme category e.g. "Equity: Large Cap"
  folio?: string;
  transactions?: CASTransaction[];
}

export interface CASTransaction {
  date: string;          // ISO date or DD-MMM-YYYY
  type?: string;
  description?: string;
  amount?: number;
  units?: number;
  nav?: number;
  balance?: number;
}

export interface CASParseResult {
  mutual_funds?: CASMutualFund[];
}

// ── Date normalisation ───────────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

export function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const mm = MONTHS[m[2].toLowerCase()];
    return mm ? `${m[3]}-${mm}-${m[1]}` : raw;
  }
  return raw;
}

// ── Transaction type normalisation ───────────────────────────────────────────

const TX_TYPE_MAP: Record<string, string> = {
  purchase: 'purchase', buy: 'purchase', sip: 'purchase',
  'additional purchase': 'purchase', 'new purchase': 'purchase',
  reinvestment: 'purchase', 'dividend reinvestment': 'purchase',
  redemption: 'redemption', sell: 'redemption', 'systematic withdrawal': 'redemption', swp: 'redemption',
  'switch in': 'switch_in', 'switch out': 'switch_out',
  dividend: 'dividend', 'dividend payout': 'dividend',
};

export function normaliseTxType(raw: string): string {
  if (!raw) return 'purchase';
  const lower = raw.toLowerCase().trim();
  if (TX_TYPE_MAP[lower]) return TX_TYPE_MAP[lower];
  if (lower.includes('switch in')) return 'switch_in';
  if (lower.includes('switch out')) return 'switch_out';
  if (lower.includes('redempt') || lower.includes('withdrawal')) return 'redemption';
  if (lower.includes('dividend')) return 'dividend';
  return 'purchase';
}

// ── Core import logic ────────────────────────────────────────────────────────

export async function importCASData(
  supabase: SupabaseClient,
  userId: string,
  importId: string,
  parsed: CASParseResult,
): Promise<{ fundsUpdated: number; transactionsAdded: number; errors: string[] }> {
  let fundsUpdated = 0;
  let transactionsAdded = 0;
  const errors: string[] = [];

  // Prefetch benchmark mappings for category → index lookup
  const { data: benchmarks } = await supabase
    .from('benchmark_mapping')
    .select('scheme_category, benchmark_index, benchmark_index_symbol');

  const benchmarkMap = new Map<string, { index: string; symbol: string }>();
  for (const b of benchmarks ?? []) {
    const bm = b as { scheme_category: string; benchmark_index: string; benchmark_index_symbol: string };
    benchmarkMap.set(bm.scheme_category, { index: bm.benchmark_index, symbol: bm.benchmark_index_symbol });
  }

  for (const mf of parsed.mutual_funds ?? []) {
    if (!mf.scheme_code) continue;

    const schemeCategory = mf.type ?? 'Flexi Cap Fund';
    const bm = benchmarkMap.get(schemeCategory) ?? benchmarkMap.get('Flexi Cap Fund');

    const { data: fundRow, error: fundErr } = await supabase
      .from('fund')
      .upsert(
        {
          user_id: userId,
          scheme_code: mf.scheme_code,
          scheme_name: mf.scheme ?? 'Unknown Fund',
          scheme_category: schemeCategory,
          benchmark_index: bm?.index ?? null,
          benchmark_index_symbol: bm?.symbol ?? null,
          is_active: true,
        },
        { onConflict: 'user_id,scheme_code' },
      )
      .select('id')
      .single();

    if (fundErr || !fundRow) {
      errors.push(`Fund upsert failed for scheme ${mf.scheme_code}: ${fundErr?.message}`);
      continue;
    }

    fundsUpdated++;

    const txRows = (mf.transactions ?? [])
      .map((tx) => ({
        user_id: userId,
        fund_id: fundRow.id as string,
        transaction_date: parseDate(tx.date),
        transaction_type: normaliseTxType(tx.type ?? tx.description ?? 'purchase'),
        units: Math.abs(tx.units ?? 0),
        nav_at_transaction: tx.nav ?? 0,
        amount: Math.abs(tx.amount ?? 0),
        folio_number: mf.folio ?? null,
        cas_import_id: importId,
      }))
      .filter((tx) => tx.units > 0);

    if (txRows.length > 0) {
      const { error: txErr, count } = await supabase
        .from('transaction')
        .upsert(txRows, {
          onConflict: 'fund_id,transaction_date,transaction_type,units,amount',
          ignoreDuplicates: true,
          count: 'exact',
        });

      if (txErr) {
        errors.push(`Transaction upsert failed for fund ${mf.scheme_code}: ${txErr.message}`);
      } else {
        transactionsAdded += count ?? txRows.length;
      }
    }
  }

  return { fundsUpdated, transactionsAdded, errors };
}
