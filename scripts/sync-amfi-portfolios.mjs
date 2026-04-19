/**
 * sync-amfi-portfolios.mjs — GitHub Actions AMFI portfolio scraper.
 *
 * Runs from Azure-hosted GitHub Actions runners (different IP space from
 * Supabase/Deno/Cloudflare), which can reach the AMFI portal where the
 * Supabase edge function cannot.
 *
 * Required env vars:
 *   SUPABASE_URL         — project URL (reuse EXPO_PUBLIC_SUPABASE_URL secret)
 *   SUPABASE_SECRET_KEY  — secret key (bypasses RLS)
 */

import { createClient } from '@supabase/supabase-js';

const FETCH_TIMEOUT_MS = 30_000;
const AMC_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// SEBI category → approximate composition
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

const FALLBACK_COMPOSITION = { equity: 80, debt: 10, cash: 10, other: 0, large: 50, mid: 30, small: 20 };

function getCategoryRules(schemeCategory) {
  const key = schemeCategory.toLowerCase().trim();
  if (CATEGORY_RULES[key]) return CATEGORY_RULES[key];
  for (const [pattern, comp] of Object.entries(CATEGORY_RULES)) {
    if (key.includes(pattern) || pattern.includes(key.split(' ').slice(0, 3).join(' '))) {
      return comp;
    }
  }
  return FALLBACK_COMPOSITION;
}

// ---------------------------------------------------------------------------
// AMC code ranges
// ---------------------------------------------------------------------------

const AMC_SCHEME_CODE_RANGES = [
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

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FundLens/1.0; +https://fundlens.app)',
        'Accept': 'text/plain,text/html,*/*',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Referer': 'https://www.amfiindia.com/',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function amfiUrlCandidates(amcId, year, month) {
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

// ---------------------------------------------------------------------------
// AMFI text parser
// ---------------------------------------------------------------------------

function parseAmfiPortfolioText(text, targetSchemeCode) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 5) return null;

  const firstDataLine = lines.find((l) => l.includes('|') || l.includes(';') || l.includes('\t'));
  if (!firstDataLine) return null;
  const delimiter = firstDataLine.includes('|') ? '|'
    : firstDataLine.includes(';') ? ';'
    : '\t';

  let inTargetScheme = false;
  const holdings = [];
  let equityPct = 0, debtPct = 0, cashPct = 0, otherPct = 0;
  let largeCapPct = 0, midCapPct = 0, smallCapPct = 0;
  const sectorMap = {};

  for (const line of lines) {
    const cols = line.split(delimiter).map((c) => c.trim());

    if (cols[0] && String(targetSchemeCode) === cols[0]) {
      inTargetScheme = true;
      continue;
    }
    if (inTargetScheme && cols[0] && /^\d{5,6}$/.test(cols[0]) && cols[0] !== String(targetSchemeCode)) {
      break;
    }
    if (!inTargetScheme) continue;
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

    if (assetType.includes('equity') || assetType.includes('stock')) {
      equityPct += navPct;
      if (marketCap === 'Large Cap') largeCapPct += navPct;
      else if (marketCap === 'Mid Cap') midCapPct += navPct;
      else if (marketCap === 'Small Cap') smallCapPct += navPct;
      if (sector) sectorMap[sector] = (sectorMap[sector] ?? 0) + navPct;
    } else if (assetType.includes('debt') || assetType.includes('bond') || assetType.includes('debenture')) {
      debtPct += navPct;
    } else if (assetType.includes('cash') || assetType.includes('cblo') || assetType.includes('reverse repo')) {
      cashPct += navPct;
    } else {
      otherPct += navPct;
    }

    if (name) holdings.push({ name, isin, sector, marketCap, pctOfNav: navPct });
  }

  if (holdings.length === 0 && equityPct === 0 && debtPct === 0) return null;

  if (equityPct > 0) {
    largeCapPct = (largeCapPct / equityPct) * 100;
    midCapPct = (midCapPct / equityPct) * 100;
    smallCapPct = (smallCapPct / equityPct) * 100;
  }

  const sectorAllocation = {};
  for (const [s, w] of Object.entries(sectorMap).sort(([, a], [, b]) => b - a)) {
    sectorAllocation[s] = Math.round(w * 100) / 100;
  }

  holdings.sort((a, b) => b.pctOfNav - a.pctOfNav);

  return {
    equityPct: Math.round(equityPct * 100) / 100,
    debtPct: Math.round(debtPct * 100) / 100,
    cashPct: Math.round(cashPct * 100) / 100,
    otherPct: Math.round(otherPct * 100) / 100,
    largeCapPct: Math.round(largeCapPct * 100) / 100,
    midCapPct: Math.round(midCapPct * 100) / 100,
    smallCapPct: Math.round(smallCapPct * 100) / 100,
    sectorAllocation,
    topHoldings: holdings.slice(0, 50),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    console.error('[sync-amfi] SUPABASE_URL and SUPABASE_SECRET_KEY are required');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  console.log('[sync-amfi] invoked');

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split('T')[0];

  // Load all active funds
  const { data: funds, error: fundsError } = await supabase
    .from('fund')
    .select('id, scheme_code, scheme_category')
    .eq('is_active', true);

  if (fundsError) {
    console.error('[sync-amfi] failed to load funds:', fundsError.message);
    process.exit(1);
  }

  if (!funds?.length) {
    console.log('[sync-amfi] no active funds, nothing to do');
    return;
  }

  // Deduplicate by scheme_code
  const schemeMap = new Map();
  for (const f of funds) {
    if (!schemeMap.has(f.scheme_code)) schemeMap.set(f.scheme_code, f);
  }
  const schemes = [...schemeMap.values()];
  console.log('[sync-amfi] %d distinct schemes to process', schemes.length);

  const schemeCodes = schemes.map((s) => s.scheme_code);

  // Check which schemes already have fresh AMFI data this month
  const { data: existing } = await supabase
    .from('fund_portfolio_composition')
    .select('scheme_code')
    .in('scheme_code', schemeCodes)
    .gte('portfolio_date', currentMonthStart)
    .eq('source', 'amfi');

  const freshAmfiCodes = new Set((existing ?? []).map((r) => r.scheme_code));
  const staleSchemes = schemes.filter((s) => !freshAmfiCodes.has(s.scheme_code));
  console.log('[sync-amfi] %d schemes need AMFI refresh (%d already fresh)',
    staleSchemes.length, freshAmfiCodes.size);

  // Group stale schemes by AMC
  const amcGroups = new Map();
  for (const scheme of staleSchemes) {
    const prefix = String(scheme.scheme_code).substring(0, 3);
    const amcInfo = AMC_SCHEME_CODE_RANGES.find((a) => prefix.startsWith(a.prefix.substring(0, 3)))
      ?? { amcId: prefix, amcName: `AMC-${prefix}` };
    const key = amcInfo.amcId;
    if (!amcGroups.has(key)) {
      amcGroups.set(key, { amcId: amcInfo.amcId, amcName: amcInfo.amcName, schemes: [] });
    }
    amcGroups.get(key).schemes.push(scheme);
  }

  let amfiSynced = 0;
  const amfiErrors = [];

  // Sequential per-AMC (polite to AMFI's server)
  const amcList = [...amcGroups.values()];
  for (let idx = 0; idx < amcList.length; idx++) {
    const group = amcList[idx];
    if (idx > 0) await delay(AMC_DELAY_MS);

    const urls = amfiUrlCandidates(group.amcId, now.getFullYear(), now.getMonth() + 1);
    let portfolioText = null;

    for (const url of urls) {
      try {
        const res = await fetchWithTimeout(url);
        if (res.ok) {
          const text = await res.text();
          if (text.length > 500) {
            portfolioText = text;
            console.log('[sync-amfi] AMC %s: fetched %d chars from %s',
              group.amcName, text.length, url);
            break;
          }
        }
        console.warn('[sync-amfi] AMC %s: HTTP %d from %s', group.amcName, res.status, url);
      } catch (err) {
        console.warn('[sync-amfi] AMC %s: fetch error %s', group.amcName, String(err));
      }
    }

    if (!portfolioText) {
      console.warn('[sync-amfi] AMC %s: all URL candidates failed', group.amcName);
      amfiErrors.push(`${group.amcName}: all_urls_failed`);
      continue;
    }

    // Log first 300 chars so we can diagnose format issues
    console.log('[sync-amfi] AMC %s: first 300 chars: %s',
      group.amcName, portfolioText.substring(0, 300).replace(/\n/g, '\\n'));

    // portfolio_date = last day of previous month (the month the data covers)
    const portfolioDate = new Date(now.getFullYear(), now.getMonth(), 0)
      .toISOString().split('T')[0];

    for (const scheme of group.schemes) {
      const parsed = parseAmfiPortfolioText(portfolioText, scheme.scheme_code);
      if (!parsed) {
        // Log a snippet around where the scheme code might appear to diagnose format
        const codeStr = String(scheme.scheme_code);
        const idx = portfolioText.indexOf(codeStr);
        const snippet = idx >= 0
          ? portfolioText.substring(Math.max(0, idx - 50), idx + 150).replace(/\n/g, '\\n')
          : `(scheme code ${codeStr} not found in text)`;
        console.warn('[sync-amfi] scheme %d: parse null. snippet: %s', scheme.scheme_code, snippet);
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
        console.error('[sync-amfi] scheme %d upsert error: %s', scheme.scheme_code, error.message);
        amfiErrors.push(`scheme-${scheme.scheme_code}: ${error.message}`);
      } else {
        amfiSynced++;
      }
    }
  }

  // Seed category_rules for any scheme still missing AMFI data
  const { data: nowHasAmfi } = await supabase
    .from('fund_portfolio_composition')
    .select('scheme_code')
    .in('scheme_code', schemeCodes)
    .gte('portfolio_date', currentMonthStart)
    .eq('source', 'amfi');

  const amfiCodeSet = new Set((nowHasAmfi ?? []).map((r) => r.scheme_code));
  const needsCategoryRules = schemes.filter((s) => !amfiCodeSet.has(s.scheme_code));
  let categorySynced = 0;

  if (needsCategoryRules.length > 0) {
    const today = now.toISOString().split('T')[0];
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
        ignoreDuplicates: true,
      });

    if (catError) {
      console.error('[sync-amfi] category_rules upsert error:', catError.message);
    } else {
      categorySynced = categoryRows.length;
      console.log('[sync-amfi] seeded category_rules for %d schemes', categorySynced);
    }
  }

  console.log('[sync-amfi] done — amfiSynced=%d categorySynced=%d errors=%d',
    amfiSynced, categorySynced, amfiErrors.length);

  if (amfiErrors.length > 0) {
    console.log('[sync-amfi] errors:', amfiErrors.join(', '));
  }

  if (amcList.length > 0 && amfiSynced === 0 && amfiErrors.length === amcList.length) {
    console.error('[sync-amfi] all AMC fetches failed — AMFI portal may be blocking this IP range');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[sync-amfi] unhandled error:', err);
  process.exit(1);
});
