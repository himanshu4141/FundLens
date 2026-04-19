/**
 * sync-fund-portfolios — builds portfolio composition data for all active funds.
 *
 * Two-layer strategy:
 *   Layer 1 (category_rules): Instant approximation derived from SEBI's fund
 *     categorisation framework — works with zero external calls, always succeeds.
 *   Layer 2 (amfi): Actual monthly portfolio disclosure data fetched from the
 *     AMFI portal, containing real sector allocation and individual stock holdings.
 *
 * Resilience design:
 *   - Per-AMC errors are isolated via Promise.allSettled — one AMC failure never
 *     blocks others.
 *   - AbortController (10 s) per HTTP fetch prevents hanging.
 *   - Idempotent upserts — safe to re-run at any time.
 *   - category_rules always seeded last — Insights screen is never empty even if
 *     all AMFI fetches fail.
 *
 * Trigger: HTTP POST (on-demand from app) or monthly cron (11th of month, 6 AM UTC).
 * Deploy with --no-verify-jwt so the app can invoke without user JWT.
 */

import { createServiceClient } from '../_shared/supabase-client.ts';
import { CORS, json } from '../_shared/cors.ts';

const FETCH_TIMEOUT_MS = 10_000;
const AMC_DELAY_MS = 300; // rate-limit between AMC fetches

// ---------------------------------------------------------------------------
// SEBI category → approximate composition (regulatory minimum exposures)
// ---------------------------------------------------------------------------

interface CategoryComposition {
  equity: number;
  debt: number;
  cash: number;
  other: number;
  large: number;  // % of equity
  mid: number;
  small: number;
}

const CATEGORY_RULES: Record<string, CategoryComposition> = {
  'large cap fund':            { equity: 95, debt: 0,  cash: 5,  other: 0, large: 80, mid: 12, small: 8  },
  'mid cap fund':              { equity: 95, debt: 0,  cash: 5,  other: 0, large: 8,  mid: 75, small: 17 },
  'small cap fund':            { equity: 90, debt: 0,  cash: 10, other: 0, large: 5,  mid: 12, small: 83 },
  'multi cap fund':            { equity: 95, debt: 0,  cash: 5,  other: 0, large: 30, mid: 35, small: 35 },
  'flexi cap fund':            { equity: 93, debt: 0,  cash: 7,  other: 0, large: 38, mid: 33, small: 29 },
  'large & mid cap fund':      { equity: 95, debt: 0,  cash: 5,  other: 0, large: 50, mid: 40, small: 10 },
  'elss':                      { equity: 95, debt: 0,  cash: 5,  other: 0, large: 42, mid: 30, small: 28 },
  'value fund':                { equity: 93, debt: 0,  cash: 7,  other: 0, large: 65, mid: 22, small: 13 },
  'contra fund':               { equity: 93, debt: 0,  cash: 7,  other: 0, large: 60, mid: 25, small: 15 },
  'focused fund':              { equity: 92, debt: 0,  cash: 8,  other: 0, large: 55, mid: 25, small: 20 },
  'sectoral/thematic':         { equity: 95, debt: 0,  cash: 5,  other: 0, large: 50, mid: 30, small: 20 },
  'dividend yield fund':       { equity: 92, debt: 0,  cash: 8,  other: 0, large: 55, mid: 28, small: 17 },
  'aggressive hybrid fund':    { equity: 78, debt: 17, cash: 5,  other: 0, large: 48, mid: 28, small: 24 },
  'balanced hybrid fund':      { equity: 50, debt: 45, cash: 5,  other: 0, large: 55, mid: 28, small: 17 },
  'conservative hybrid fund':  { equity: 20, debt: 73, cash: 7,  other: 0, large: 60, mid: 25, small: 15 },
  'balanced advantage fund':   { equity: 55, debt: 35, cash: 10, other: 0, large: 55, mid: 28, small: 17 },
  'dynamic asset allocation':  { equity: 55, debt: 35, cash: 10, other: 0, large: 55, mid: 28, small: 17 },
  'multi asset allocation':    { equity: 50, debt: 30, cash: 10, other: 10, large: 50, mid: 28, small: 22 },
  'equity savings fund':       { equity: 35, debt: 45, cash: 20, other: 0, large: 60, mid: 25, small: 15 },
  'arbitrage fund':            { equity: 65, debt: 30, cash: 5,  other: 0, large: 75, mid: 20, small: 5  },
  // Debt categories
  'overnight fund':            { equity: 0,  debt: 5,  cash: 95, other: 0, large: 0,  mid: 0,  small: 0  },
  'liquid fund':               { equity: 0,  debt: 20, cash: 80, other: 0, large: 0,  mid: 0,  small: 0  },
  'ultra short duration fund': { equity: 0,  debt: 92, cash: 8,  other: 0, large: 0,  mid: 0,  small: 0  },
  'low duration fund':         { equity: 0,  debt: 92, cash: 8,  other: 0, large: 0,  mid: 0,  small: 0  },
  'money market fund':         { equity: 0,  debt: 92, cash: 8,  other: 0, large: 0,  mid: 0,  small: 0  },
  'short duration fund':       { equity: 0,  debt: 92, cash: 8,  other: 0, large: 0,  mid: 0,  small: 0  },
  'medium duration fund':      { equity: 0,  debt: 92, cash: 8,  other: 0, large: 0,  mid: 0,  small: 0  },
  'medium to long duration':   { equity: 0,  debt: 92, cash: 8,  other: 0, large: 0,  mid: 0,  small: 0  },
  'long duration fund':        { equity: 0,  debt: 92, cash: 8,  other: 0, large: 0,  mid: 0,  small: 0  },
  'dynamic bond fund':         { equity: 0,  debt: 92, cash: 8,  other: 0, large: 0,  mid: 0,  small: 0  },
  'corporate bond fund':       { equity: 0,  debt: 92, cash: 8,  other: 0, large: 0,  mid: 0,  small: 0  },
  'credit risk fund':          { equity: 0,  debt: 90, cash: 10, other: 0, large: 0,  mid: 0,  small: 0  },
  'banking and psu fund':      { equity: 0,  debt: 92, cash: 8,  other: 0, large: 0,  mid: 0,  small: 0  },
  'gilt fund':                 { equity: 0,  debt: 92, cash: 8,  other: 0, large: 0,  mid: 0,  small: 0  },
  'floater fund':              { equity: 0,  debt: 92, cash: 8,  other: 0, large: 0,  mid: 0,  small: 0  },
  // FoF / passive
  'index funds':               { equity: 95, debt: 0,  cash: 5,  other: 0, large: 90, mid: 8,  small: 2  },
  'other etfs':                { equity: 95, debt: 0,  cash: 5,  other: 0, large: 90, mid: 8,  small: 2  },
  'fund of funds investing overseas': { equity: 0, debt: 0, cash: 0, other: 100, large: 0, mid: 0, small: 0 },
  'fund of funds domestic':    { equity: 50, debt: 30, cash: 5,  other: 15, large: 45, mid: 25, small: 20 },
  'solution oriented - retirement': { equity: 80, debt: 15, cash: 5, other: 0, large: 50, mid: 28, small: 22 },
  'solution oriented - childrens': { equity: 70, debt: 25, cash: 5, other: 0, large: 50, mid: 28, small: 22 },
};

const FALLBACK_COMPOSITION: CategoryComposition = {
  equity: 80, debt: 10, cash: 10, other: 0,
  large: 50, mid: 30, small: 20,
};

function getCategoryRules(schemeCategory: string): CategoryComposition {
  const key = schemeCategory.toLowerCase().trim();
  // Exact match first
  if (CATEGORY_RULES[key]) return CATEGORY_RULES[key];
  // Partial match for variants
  for (const [pattern, comp] of Object.entries(CATEGORY_RULES)) {
    if (key.includes(pattern) || pattern.includes(key.split(' ').slice(0, 3).join(' '))) {
      return comp;
    }
  }
  return FALLBACK_COMPOSITION;
}

// ---------------------------------------------------------------------------
// AMFI portal fetching
// ---------------------------------------------------------------------------

// AMC code → AMFI AMC identifier (scheme_code prefix ranges)
// These are approximate ranges; AMFI assigns codes sequentially per AMC.
const AMC_SCHEME_CODE_RANGES: Array<{ prefix: string; amcId: string; amcName: string }> = [
  { prefix: '100',  amcId: '1',  amcName: 'SBI' },
  { prefix: '101',  amcId: '2',  amcName: 'HDFC' },
  { prefix: '102',  amcId: '3',  amcName: 'ICICI Prudential' },
  { prefix: '103',  amcId: '4',  amcName: 'Franklin' },
  { prefix: '104',  amcId: '5',  amcName: 'Birla' },
  { prefix: '105',  amcId: '6',  amcName: 'Kotak' },
  { prefix: '106',  amcId: '7',  amcName: 'Reliance' },
  { prefix: '107',  amcId: '8',  amcName: 'UTI' },
  { prefix: '108',  amcId: '9',  amcName: 'Tata' },
  { prefix: '109',  amcId: '10', amcName: 'Principal' },
  { prefix: '110',  amcId: '11', amcName: 'DSP' },
  { prefix: '118',  amcId: '18', amcName: 'PPFAS' },
  { prefix: '119',  amcId: '19', amcName: 'Mirae' },
  { prefix: '120',  amcId: '20', amcName: 'HDFC (new)' },
  { prefix: '122',  amcId: '22', amcName: 'Axis' },
  { prefix: '128',  amcId: '28', amcName: 'Motilal Oswal' },
  { prefix: '135',  amcId: '35', amcName: 'Nippon' },
  { prefix: '140',  amcId: '40', amcName: 'Quant' },
];

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'FundLens/1.0' },
    });
  } finally {
    clearTimeout(timer);
  }
}

interface AmfiHolding {
  name: string;
  isin: string;
  sector: string;
  marketCap: string;
  pctOfNav: number;
}

interface AmfiParseResult {
  equityPct: number;
  debtPct: number;
  cashPct: number;
  otherPct: number;
  largeCapPct: number;
  midCapPct: number;
  smallCapPct: number;
  sectorAllocation: Record<string, number>;
  topHoldings: AmfiHolding[];
}

/**
 * Parse AMFI-format portfolio disclosure text.
 * Format (pipe or semicolon delimited, per SEBI circular):
 * Company Name | ISIN | Industry | Rating | Quantity | Market Value | % to NAV | YTM | Asset Type
 *
 * The function is deliberately forgiving — it extracts what it can and ignores
 * malformed rows rather than throwing.
 */
function parseAmfiPortfolioText(text: string, targetSchemeCode: number): AmfiParseResult | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 5) return null;

  // Detect delimiter
  const firstDataLine = lines.find((l) => l.includes('|') || l.includes(';') || l.includes('\t'));
  if (!firstDataLine) return null;
  const delimiter = firstDataLine.includes('|') ? '|'
    : firstDataLine.includes(';') ? ';'
    : '\t';

  // Find the section for our scheme_code
  let inTargetScheme = false;
  const holdings: AmfiHolding[] = [];
  let equityPct = 0, debtPct = 0, cashPct = 0, otherPct = 0;
  let largeCapPct = 0, midCapPct = 0, smallCapPct = 0;
  const sectorMap: Record<string, number> = {};

  for (const line of lines) {
    const cols = line.split(delimiter).map((c) => c.trim());

    // Detect scheme header rows (contain scheme_code)
    if (cols[0] && String(targetSchemeCode) === cols[0]) {
      inTargetScheme = true;
      continue;
    }
    // Stop when next scheme starts
    if (inTargetScheme && cols[0] && /^\d{5,6}$/.test(cols[0]) && cols[0] !== String(targetSchemeCode)) {
      break;
    }
    if (!inTargetScheme) continue;

    // Skip header rows
    if (cols[0]?.toLowerCase().includes('company') || cols[0]?.toLowerCase().includes('scheme')) continue;

    const navPct = parseFloat(cols[5] ?? cols[6] ?? '');
    if (isNaN(navPct) || navPct <= 0) continue;

    const name = cols[0] ?? '';
    const isin = cols[1] ?? '';
    const sector = cols[2] ?? 'Other';
    const assetType = (cols[8] ?? cols[7] ?? '').toLowerCase();
    const marketCapRaw = (cols[9] ?? '').toLowerCase();

    const marketCap = marketCapRaw.includes('large') ? 'Large Cap'
      : marketCapRaw.includes('mid') ? 'Mid Cap'
      : marketCapRaw.includes('small') ? 'Small Cap'
      : 'Other';

    // Aggregate by asset type
    if (assetType.includes('equity') || assetType.includes('stock')) {
      equityPct += navPct;
      // Market cap totals
      if (marketCap === 'Large Cap') largeCapPct += navPct;
      else if (marketCap === 'Mid Cap') midCapPct += navPct;
      else if (marketCap === 'Small Cap') smallCapPct += navPct;
      // Sector map
      if (sector) sectorMap[sector] = (sectorMap[sector] ?? 0) + navPct;
    } else if (assetType.includes('debt') || assetType.includes('bond') || assetType.includes('debenture')) {
      debtPct += navPct;
    } else if (assetType.includes('cash') || assetType.includes('cblo') || assetType.includes('reverse repo')) {
      cashPct += navPct;
    } else {
      otherPct += navPct;
    }

    if (name) {
      holdings.push({ name, isin, sector, marketCap, pctOfNav: navPct });
    }
  }

  if (holdings.length === 0 && equityPct === 0 && debtPct === 0) return null;

  // Normalise market cap to % of equity
  if (equityPct > 0) {
    largeCapPct = (largeCapPct / equityPct) * 100;
    midCapPct = (midCapPct / equityPct) * 100;
    smallCapPct = (smallCapPct / equityPct) * 100;
  }

  // Sort sector by descending weight
  const sectorAllocation: Record<string, number> = {};
  for (const [s, w] of Object.entries(sectorMap).sort(([, a], [, b]) => b - a)) {
    sectorAllocation[s] = Math.round(w * 100) / 100;
  }

  // Sort holdings by navPct desc, cap at 50
  holdings.sort((a, b) => b.pctOfNav - a.pctOfNav);
  const topHoldings = holdings.slice(0, 50);

  return {
    equityPct: Math.round(equityPct * 100) / 100,
    debtPct: Math.round(debtPct * 100) / 100,
    cashPct: Math.round(cashPct * 100) / 100,
    otherPct: Math.round(otherPct * 100) / 100,
    largeCapPct: Math.round(largeCapPct * 100) / 100,
    midCapPct: Math.round(midCapPct * 100) / 100,
    smallCapPct: Math.round(smallCapPct * 100) / 100,
    sectorAllocation,
    topHoldings,
  };
}

// AMFI portfolio disclosure URL candidates (tried in order per AMC)
function amfiUrlCandidates(amcId: string, year: number, month: number): string[] {
  const mm = String(month).padStart(2, '0');
  const yyyy = String(year);
  const mmyyyy = `${mm}${yyyy}`;
  const yyyymm = `${yyyy}${mm}`;
  return [
    `https://www.amfiindia.com/spages/Portfolio${amcId}${mmyyyy}.txt`,
    `https://www.amfiindia.com/modules/portfolio_download?mf=${amcId}&disc=Portfolio${mmyyyy}`,
    `https://portal.amfiindia.com/DownloadSchemeData_Po.aspx?mf=${amcId}&tp=1`,
    `https://www.amfiindia.com/spages/Portfolio${amcId}${yyyymm}.txt`,
  ];
}

interface SchemeRow {
  id: string;
  scheme_code: number;
  scheme_category: string;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  console.log('[sync-fund-portfolios] invoked method=%s', req.method);

  const supabase = createServiceClient();
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Load all active funds across all users (global data — not per-user)
  const { data: funds, error: fundsError } = await supabase
    .from('fund')
    .select('id, scheme_code, scheme_category')
    .eq('is_active', true);

  if (fundsError) {
    console.error('[sync-fund-portfolios] failed to load funds:', fundsError.message);
    return json({ success: false, error: fundsError.message }, { status: 500 });
  }

  if (!funds?.length) {
    return json({ success: true, message: 'No active funds', categorySynced: 0, amfiSynced: 0 });
  }

  // Deduplicate by scheme_code (multiple users can hold the same fund)
  const schemeMap = new Map<number, SchemeRow>();
  for (const f of funds as SchemeRow[]) {
    if (!schemeMap.has(f.scheme_code)) schemeMap.set(f.scheme_code, f);
  }
  const schemes = [...schemeMap.values()];
  console.log('[sync-fund-portfolios] %d distinct schemes to process', schemes.length);

  // Check which schemes already have fresh AMFI data this month
  const schemeCodes = schemes.map((s) => s.scheme_code);
  const { data: existing } = await supabase
    .from('fund_portfolio_composition')
    .select('scheme_code, source, portfolio_date')
    .in('scheme_code', schemeCodes)
    .gte('portfolio_date', currentMonthStart.toISOString().split('T')[0])
    .eq('source', 'amfi');

  const freshAmfiCodes = new Set((existing ?? []).map((r: { scheme_code: number }) => r.scheme_code));
  const staleSchemes = schemes.filter((s) => !freshAmfiCodes.has(s.scheme_code));
  console.log('[sync-fund-portfolios] %d schemes need AMFI refresh', staleSchemes.length);

  // Group stale schemes by AMC (by scheme_code prefix)
  const amcGroups = new Map<string, { amcId: string; amcName: string; schemes: SchemeRow[] }>();
  for (const scheme of staleSchemes) {
    const prefix = String(scheme.scheme_code).substring(0, 3);
    const amcInfo = AMC_SCHEME_CODE_RANGES.find((a) => prefix.startsWith(a.prefix.substring(0, 3)))
      ?? { amcId: prefix, amcName: `AMC-${prefix}` };
    const key = amcInfo.amcId;
    if (!amcGroups.has(key)) {
      amcGroups.set(key, { amcId: amcInfo.amcId, amcName: amcInfo.amcName, schemes: [] });
    }
    amcGroups.get(key)!.schemes.push(scheme);
  }

  let amfiSynced = 0;
  const amfiErrors: string[] = [];

  // Try AMFI fetch per AMC group
  const amcList = [...amcGroups.values()];
  const amfiResults = await Promise.allSettled(
    amcList.map(async (group, idx) => {
      if (idx > 0) await delay(idx * AMC_DELAY_MS);

      const urls = amfiUrlCandidates(group.amcId, now.getFullYear(), now.getMonth() + 1);
      let portfolioText: string | null = null;

      for (const url of urls) {
        try {
          const res = await fetchWithTimeout(url);
          if (res.ok) {
            const text = await res.text();
            if (text.length > 500) { // sanity check — real files are large
              portfolioText = text;
              console.log('[sync-fund-portfolios] AMC %s: fetched %d chars from %s',
                group.amcName, text.length, url);
              break;
            }
          }
          console.warn('[sync-fund-portfolios] AMC %s: %d from %s', group.amcName, res.status, url);
        } catch (err) {
          console.warn('[sync-fund-portfolios] AMC %s: fetch error %s', group.amcName, String(err));
        }
      }

      if (!portfolioText) {
        console.warn('[sync-fund-portfolios] AMC %s: all URL candidates failed, will use category_rules',
          group.amcName);
        return { amcName: group.amcName, synced: 0, error: 'all_urls_failed' };
      }

      // Parse and upsert for each scheme in this AMC
      let synced = 0;
      const portfolioDate = new Date(now.getFullYear(), now.getMonth(), 0) // last day of previous month
        .toISOString().split('T')[0];

      for (const scheme of group.schemes) {
        const parsed = parseAmfiPortfolioText(portfolioText, scheme.scheme_code);
        if (!parsed) {
          console.warn('[sync-fund-portfolios] scheme %d: parse returned null — skipping AMFI row',
            scheme.scheme_code);
          continue;
        }

        const notClassified = Math.max(0,
          100 - parsed.largeCapPct - parsed.midCapPct - parsed.smallCapPct);

        const { error } = await supabase
          .from('fund_portfolio_composition')
          .upsert({
            scheme_code: scheme.scheme_code,
            portfolio_date: portfolioDate,
            equity_pct: parsed.equityPct,
            debt_pct: parsed.debtPct,
            cash_pct: parsed.cashPct,
            other_pct: parsed.otherPct,
            large_cap_pct: parsed.largeCapPct,
            mid_cap_pct: parsed.midCapPct,
            small_cap_pct: parsed.smallCapPct,
            not_classified_pct: notClassified,
            sector_allocation: parsed.sectorAllocation,
            top_holdings: parsed.topHoldings,
            source: 'amfi',
            synced_at: new Date().toISOString(),
          }, { onConflict: 'scheme_code,portfolio_date,source' });

        if (error) {
          console.error('[sync-fund-portfolios] scheme %d upsert error: %s',
            scheme.scheme_code, error.message);
        } else {
          synced++;
          amfiSynced++;
        }
      }
      return { amcName: group.amcName, synced, error: null };
    }),
  );

  for (const result of amfiResults) {
    if (result.status === 'rejected') {
      amfiErrors.push(String(result.reason));
    } else if (result.value.error) {
      amfiErrors.push(`${result.value.amcName}: ${result.value.error}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Layer 1: seed category_rules for any scheme still missing composition data
  // ---------------------------------------------------------------------------
  const today = now.toISOString().split('T')[0];
  let categorySynced = 0;

  // Re-check which schemes now have AMFI data (just synced or already had it)
  const { data: nowHasAmfi } = await supabase
    .from('fund_portfolio_composition')
    .select('scheme_code')
    .in('scheme_code', schemeCodes)
    .gte('portfolio_date', currentMonthStart.toISOString().split('T')[0])
    .eq('source', 'amfi');

  const amfiCodeSet = new Set((nowHasAmfi ?? []).map((r: { scheme_code: number }) => r.scheme_code));
  const needsCategoryRules = schemes.filter((s) => !amfiCodeSet.has(s.scheme_code));

  if (needsCategoryRules.length > 0) {
    const categoryRows = needsCategoryRules.map((scheme) => {
      const comp = getCategoryRules(scheme.scheme_category);
      const notClassified = Math.max(0, 100 - comp.large - comp.mid - comp.small);
      return {
        scheme_code: scheme.scheme_code,
        portfolio_date: today,
        equity_pct: comp.equity,
        debt_pct: comp.debt,
        cash_pct: comp.cash,
        other_pct: comp.other,
        large_cap_pct: comp.large,
        mid_cap_pct: comp.mid,
        small_cap_pct: comp.small,
        not_classified_pct: notClassified,
        sector_allocation: null,
        top_holdings: null,
        source: 'category_rules',
        synced_at: new Date().toISOString(),
      };
    });

    const { error: catError } = await supabase
      .from('fund_portfolio_composition')
      .upsert(categoryRows, {
        onConflict: 'scheme_code,portfolio_date,source',
        ignoreDuplicates: true, // never overwrite existing category_rules with stale approximation
      });

    if (catError) {
      console.error('[sync-fund-portfolios] category_rules upsert error:', catError.message);
    } else {
      categorySynced = categoryRows.length;
      console.log('[sync-fund-portfolios] seeded category_rules for %d schemes', categorySynced);
    }
  }

  console.log('[sync-fund-portfolios] done — amfiSynced=%d categorySynced=%d errors=%d',
    amfiSynced, categorySynced, amfiErrors.length);

  return json({
    success: true,
    schemesProcessed: schemes.length,
    amfiSynced,
    categorySynced,
    freshSkipped: freshAmfiCodes.size,
    errors: amfiErrors,
  });
});
