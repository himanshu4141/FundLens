/**
 * sync-amfi-portfolios.mjs — GitHub Actions portfolio data sync via mfdata.in.
 *
 * mfdata.in is a free REST API that sources from AMFI monthly disclosures.
 * It is accessible from GitHub Actions (Azure IPs) with no auth required.
 *
 * Flow per scheme:
 *   1. GET /api/v1/schemes/{scheme_code} → family_id
 *   2. GET /api/v1/families/{family_id}/holdings → real equity holdings + sector allocation
 *   3. Upsert to fund_portfolio_composition with source='amfi'
 *
 * For schemes where mfdata.in returns no data, falls back to category_rules.
 *
 * Rate limits: 120 req/min, 10k req/day — well within budget for typical portfolios.
 *
 * Required env vars:
 *   SUPABASE_URL         — project URL (reuse EXPO_PUBLIC_SUPABASE_URL secret)
 *   SUPABASE_SECRET_KEY  — secret key (bypasses RLS)
 */

import { createClient } from '@supabase/supabase-js';

const MFDATA_BASE = 'https://mfdata.in/api/v1';
const FETCH_TIMEOUT_MS = 15_000;
const REQUEST_DELAY_MS = 300; // stay well within 120 req/min

// ---------------------------------------------------------------------------
// SEBI category → approximate composition (used as fallback for market cap
// breakdown and for schemes mfdata.in doesn't cover)
// ---------------------------------------------------------------------------

const CATEGORY_RULES = {
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
  'index funds':               { equity: 95, debt: 0,  cash: 5,  other: 0, large: 90, mid: 8,  small: 2  },
  'other etfs':                { equity: 95, debt: 0,  cash: 5,  other: 0, large: 90, mid: 8,  small: 2  },
  'fund of funds investing overseas': { equity: 0, debt: 0, cash: 0, other: 100, large: 0, mid: 0, small: 0 },
  'fund of funds domestic':    { equity: 50, debt: 30, cash: 5,  other: 15, large: 45, mid: 25, small: 20 },
  'solution oriented - retirement': { equity: 80, debt: 15, cash: 5, other: 0, large: 50, mid: 28, small: 22 },
  'solution oriented - childrens': { equity: 70, debt: 25, cash: 5, other: 0, large: 50, mid: 28, small: 22 },
};

// Generic single-word categories that AMFI sometimes uses — map to reasonable defaults
const GENERIC_CATEGORY_MAP = {
  'equity': { equity: 93, debt: 0,  cash: 7,  other: 0,   large: 38, mid: 33, small: 29 }, // flexi cap proxy
  'debt':   { equity: 0,  debt: 90, cash: 10, other: 0,   large: 0,  mid: 0,  small: 0  },
  'hybrid': { equity: 65, debt: 25, cash: 10, other: 0,   large: 48, mid: 28, small: 24 },
  'other':  { equity: 0,  debt: 0,  cash: 0,  other: 100, large: 0,  mid: 0,  small: 0  },
};

const FALLBACK_COMPOSITION = { equity: 80, debt: 10, cash: 10, other: 0, large: 50, mid: 30, small: 20 };

function getCategoryRules(schemeCategory) {
  const key = schemeCategory.toLowerCase().trim();
  if (CATEGORY_RULES[key]) return CATEGORY_RULES[key];
  if (GENERIC_CATEGORY_MAP[key]) return GENERIC_CATEGORY_MAP[key];
  // Partial match: only fire when the key has 2+ words to avoid 'equity' matching 'equity savings fund'
  if (key.split(' ').length >= 2) {
    for (const [pattern, comp] of Object.entries(CATEGORY_RULES)) {
      if (key.includes(pattern) || pattern.includes(key.split(' ').slice(0, 3).join(' '))) {
        return comp;
      }
    }
  }
  return FALLBACK_COMPOSITION;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'FundLens/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// mfdata.in helpers
// ---------------------------------------------------------------------------

async function getSchemeInfo(schemeCode) {
  const data = await fetchJson(`${MFDATA_BASE}/schemes/${schemeCode}`);
  return data?.data ?? null;
}

async function getFamilyHoldings(familyId) {
  const data = await fetchJson(`${MFDATA_BASE}/families/${familyId}/holdings`);
  return data?.data ?? null;
}

function buildPortfolioFromHoldings(holdings, schemeCategory) {
  const catRules = getCategoryRules(schemeCategory);

  // equity_pct from API is reliable; debt/cash from category_rules as approximation
  const equityPct = typeof holdings.equity_pct === 'number' ? holdings.equity_pct : catRules.equity;
  // Cap debt so equity + debt never exceeds 100 (guards against bad category matches)
  const debtPct = Math.min(catRules.debt, Math.max(0, 100 - equityPct));
  const cashPct = Math.max(0, 100 - equityPct - debtPct);
  const otherPct = 0;

  // Build sector allocation from real holdings
  const sectorMap = {};
  const equityHoldings = holdings.equity_holdings ?? [];
  for (const h of equityHoldings) {
    if (h.sector && typeof h.weight_pct === 'number') {
      sectorMap[h.sector] = (sectorMap[h.sector] ?? 0) + h.weight_pct;
    }
  }

  const sectorAllocation = {};
  for (const [s, w] of Object.entries(sectorMap).sort(([, a], [, b]) => b - a)) {
    sectorAllocation[s] = Math.round(w * 100) / 100;
  }

  // Top holdings
  const topHoldings = equityHoldings
    .filter((h) => h.stock_name && typeof h.weight_pct === 'number')
    .sort((a, b) => b.weight_pct - a.weight_pct)
    .slice(0, 50)
    .map((h) => ({
      name: h.stock_name,
      isin: h.isin ?? '',
      sector: h.sector ?? 'Other',
      marketCap: 'Other', // mfdata.in doesn't provide market cap classification
      pctOfNav: h.weight_pct,
    }));

  return {
    equityPct: Math.round(equityPct * 100) / 100,
    debtPct: Math.round(debtPct * 100) / 100,
    cashPct: Math.round(cashPct * 100) / 100,
    otherPct: Math.round(otherPct * 100) / 100,
    // Market cap breakdown from category_rules (mfdata.in doesn't classify by cap)
    largeCapPct: catRules.large,
    midCapPct: catRules.mid,
    smallCapPct: catRules.small,
    sectorAllocation: Object.keys(sectorAllocation).length > 0 ? sectorAllocation : null,
    topHoldings: topHoldings.length > 0 ? topHoldings : null,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    console.error('[sync-portfolio] SUPABASE_URL and SUPABASE_SECRET_KEY are required');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  console.log('[sync-portfolio] invoked');

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split('T')[0];
  const portfolioDate = new Date(now.getFullYear(), now.getMonth(), 0)
    .toISOString().split('T')[0]; // last day of previous month

  // Load all active funds
  const { data: funds, error: fundsError } = await supabase
    .from('fund')
    .select('id, scheme_code, scheme_category')
    .eq('is_active', true);

  if (fundsError) {
    console.error('[sync-portfolio] failed to load funds:', fundsError.message);
    process.exit(1);
  }

  if (!funds?.length) {
    console.log('[sync-portfolio] no active funds, nothing to do');
    return;
  }

  // Deduplicate by scheme_code
  const schemeMap = new Map();
  for (const f of funds) {
    if (!schemeMap.has(f.scheme_code)) schemeMap.set(f.scheme_code, f);
  }
  const schemes = [...schemeMap.values()];
  console.log('[sync-portfolio] %d distinct schemes to process', schemes.length);

  const schemeCodes = schemes.map((s) => s.scheme_code);

  // Skip schemes already synced this month
  const { data: existing } = await supabase
    .from('fund_portfolio_composition')
    .select('scheme_code')
    .in('scheme_code', schemeCodes)
    .gte('portfolio_date', currentMonthStart)
    .eq('source', 'amfi');

  const freshCodes = new Set((existing ?? []).map((r) => r.scheme_code));
  const staleSchemes = schemes.filter((s) => !freshCodes.has(s.scheme_code));
  console.log('[sync-portfolio] %d schemes need refresh (%d already fresh)',
    staleSchemes.length, freshCodes.size);

  let amfiSynced = 0;
  let errors = 0;

  for (let i = 0; i < staleSchemes.length; i++) {
    const scheme = staleSchemes[i];
    if (i > 0) await delay(REQUEST_DELAY_MS);

    try {
      // Step 1: resolve family_id
      const schemeInfo = await getSchemeInfo(scheme.scheme_code);
      if (!schemeInfo?.family_id) {
        console.warn('[sync-portfolio] scheme %d: no family_id from mfdata.in', scheme.scheme_code);
        errors++;
        continue;
      }

      const familyId = schemeInfo.family_id;
      await delay(REQUEST_DELAY_MS);

      // Step 2: fetch holdings
      const holdings = await getFamilyHoldings(familyId);
      if (!holdings || !holdings.equity_holdings?.length) {
        console.warn('[sync-portfolio] scheme %d (family %d): no holdings data', scheme.scheme_code, familyId);
        errors++;
        continue;
      }

      // Step 3: build portfolio row
      const portfolio = buildPortfolioFromHoldings(holdings, scheme.scheme_category);
      const notClassified = Math.max(0, 100 - portfolio.largeCapPct - portfolio.midCapPct - portfolio.smallCapPct);

      const { error } = await supabase
        .from('fund_portfolio_composition')
        .upsert({
          scheme_code: scheme.scheme_code,
          portfolio_date: portfolioDate,
          equity_pct: portfolio.equityPct,
          debt_pct: portfolio.debtPct,
          cash_pct: portfolio.cashPct,
          other_pct: portfolio.otherPct,
          large_cap_pct: portfolio.largeCapPct,
          mid_cap_pct: portfolio.midCapPct,
          small_cap_pct: portfolio.smallCapPct,
          not_classified_pct: notClassified,
          sector_allocation: portfolio.sectorAllocation,
          top_holdings: portfolio.topHoldings,
          source: 'amfi',
          synced_at: new Date().toISOString(),
        }, { onConflict: 'scheme_code,portfolio_date,source' });

      if (error) {
        console.error('[sync-portfolio] scheme %d upsert error: %s', scheme.scheme_code, error.message);
        errors++;
      } else {
        amfiSynced++;
        console.log('[sync-portfolio] scheme %d: synced %d equity holdings (%d sectors)',
          scheme.scheme_code,
          holdings.equity_holdings.length,
          Object.keys(portfolio.sectorAllocation ?? {}).length);
      }
    } catch (err) {
      console.error('[sync-portfolio] scheme %d: %s', scheme.scheme_code, String(err));
      errors++;
    }
  }

  // Seed category_rules for any scheme mfdata.in couldn't cover
  const { data: nowHasAmfi } = await supabase
    .from('fund_portfolio_composition')
    .select('scheme_code')
    .in('scheme_code', schemeCodes)
    .gte('portfolio_date', currentMonthStart)
    .eq('source', 'amfi');

  const amfiCodeSet = new Set((nowHasAmfi ?? []).map((r) => r.scheme_code));
  const needsFallback = schemes.filter((s) => !amfiCodeSet.has(s.scheme_code));
  let categorySynced = 0;

  if (needsFallback.length > 0) {
    const today = now.toISOString().split('T')[0];
    const categoryRows = needsFallback.map((scheme) => {
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
        ignoreDuplicates: true,
      });

    if (catError) {
      console.error('[sync-portfolio] category_rules upsert error:', catError.message);
    } else {
      categorySynced = categoryRows.length;
      console.log('[sync-portfolio] seeded category_rules for %d schemes', categorySynced);
    }
  }

  console.log('[sync-portfolio] done — amfiSynced=%d categorySynced=%d errors=%d',
    amfiSynced, categorySynced, errors);

  if (staleSchemes.length > 0 && amfiSynced === 0 && errors === staleSchemes.length) {
    console.error('[sync-portfolio] all schemes failed — mfdata.in may be down');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[sync-portfolio] unhandled error:', err);
  process.exit(1);
});
