import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
loadLocalEnv(path.join(ROOT, '.env.local'));

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DEMO_EMAIL =
  process.env.DEV_DEMO_EMAIL ??
  process.env.EXPO_PUBLIC_DEV_AUTH_EMAIL ??
  '';
const DEMO_PASSWORD =
  process.env.DEV_DEMO_PASSWORD ??
  process.env.EXPO_PUBLIC_DEV_AUTH_PASSWORD ??
  '';
const DEMO_PAN = process.env.DEV_DEMO_PAN ?? 'ABCDE1234F';
const DEMO_KFINTECH_EMAIL = process.env.DEV_DEMO_KFINTECH_EMAIL ?? 'demo-import@example.com';
const DEMO_INBOUND_EMAIL = 'demo-inbound@fundlens.local';
const DEMO_INBOUND_ID = 'demo-inbound-session';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DEMO_EMAIL || !DEMO_PASSWORD) {
  console.error(
    'Missing required env. Need EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, and demo email/password.',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_FUNDS = [
  {
    schemeCode: 990001,
    schemeName: 'FundLens Large Cap Demo Fund',
    schemeCategory: 'Large Cap Fund',
    benchmarkIndex: 'Nifty 50',
    benchmarkSymbol: '^NSEI',
    baselineNav: 102,
    driftPerDay: 0.035,
    waveSize: 1.8,
  },
  {
    schemeCode: 990002,
    schemeName: 'FundLens Mid Cap Demo Fund',
    schemeCategory: 'Mid Cap Fund',
    benchmarkIndex: 'Nifty Midcap 150 TRI',
    benchmarkSymbol: '^NIFTYMIDCAP150',
    baselineNav: 78,
    driftPerDay: 0.05,
    waveSize: 2.4,
  },
  {
    schemeCode: 990003,
    schemeName: 'FundLens Flexi Cap Demo Fund',
    schemeCategory: 'Flexi Cap Fund',
    benchmarkIndex: 'Nifty 500 TRI',
    benchmarkSymbol: '^NIFTY500',
    baselineNav: 64,
    driftPerDay: 0.042,
    waveSize: 2.1,
  },
];

const DEMO_INDEXES = [
  { symbol: '^NSEI', name: 'Nifty 50', baseline: 21000, driftPerDay: 3.2, waveSize: 110 },
  { symbol: '^NSEBANK', name: 'Nifty Bank', baseline: 46500, driftPerDay: 6.2, waveSize: 220 },
  { symbol: '^BSESN', name: 'SENSEX', baseline: 69000, driftPerDay: 8.8, waveSize: 260 },
  { symbol: '^CNXIT', name: 'Nifty IT', baseline: 34500, driftPerDay: 5.4, waveSize: 180 },
  { symbol: '^NIFTYMIDCAP150', name: 'Nifty Midcap 150 TRI', baseline: 17000, driftPerDay: 4.9, waveSize: 145 },
  { symbol: '^NIFTY500', name: 'Nifty 500 TRI', baseline: 15200, driftPerDay: 2.9, waveSize: 95 },
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const user = await getOrCreateDemoUser();
  await resetDemoPortfolio(user.id);
  await seedProfile(user.id);
  const funds = await seedFunds(user.id);
  await seedTransactions(user.id, funds);
  await seedNavHistory();
  await seedIndexHistory();

  console.log(`Demo user ready: ${DEMO_EMAIL}`);
  console.log('Use the local dev auth shortcut to sign in.');
}

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function getOrCreateDemoUser() {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const existing = data.users.find((user) => user.email?.toLowerCase() === DEMO_EMAIL.toLowerCase());
    if (existing) {
      const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(
        existing.id,
        {
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: { role: 'demo', seeded_by: 'scripts/seed-demo-user.mjs' },
        },
      );

      if (updateError) throw updateError;
      return updated.user;
    }

    if (data.users.length < perPage) break;
    page += 1;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { role: 'demo', seeded_by: 'scripts/seed-demo-user.mjs' },
  });

  if (error) throw error;
  return data.user;
}

async function resetDemoPortfolio(userId) {
  await mustSucceed(supabase.from('transaction').delete().eq('user_id', userId));
  await mustSucceed(supabase.from('fund').delete().eq('user_id', userId));
  await mustSucceed(supabase.from('cas_import').delete().eq('user_id', userId));
  await mustSucceed(supabase.from('cas_inbound_session').delete().eq('user_id', userId));
  await mustSucceed(supabase.from('user_profile').delete().eq('user_id', userId));
}

async function seedProfile(userId) {
  await mustSucceed(
    supabase.from('user_profile').upsert(
      {
        user_id: userId,
        pan: DEMO_PAN,
        kfintech_email: DEMO_KFINTECH_EMAIL,
      },
      { onConflict: 'user_id' },
    ),
  );

  await mustSucceed(
    supabase.from('cas_inbound_session').upsert(
      {
        user_id: userId,
        inbound_email_id: DEMO_INBOUND_ID,
        inbound_email_address: DEMO_INBOUND_EMAIL,
      },
      { onConflict: 'user_id' },
    ),
  );
}

async function seedFunds(userId) {
  const inserted = [];

  for (const fund of DEMO_FUNDS) {
    const { data, error } = await supabase
      .from('fund')
      .upsert(
        {
          user_id: userId,
          scheme_code: fund.schemeCode,
          scheme_name: fund.schemeName,
          scheme_category: fund.schemeCategory,
          benchmark_index: fund.benchmarkIndex,
          benchmark_index_symbol: fund.benchmarkSymbol,
          is_active: true,
        },
        { onConflict: 'user_id,scheme_code' },
      )
      .select('id')
      .single();

    if (error) throw error;
    inserted.push({ ...fund, id: data.id });
  }

  return inserted;
}

async function seedTransactions(userId, funds) {
  const rows = [];

  for (const [fundIndex, fund] of funds.entries()) {
    for (let month = 0; month < 16; month += 1) {
      const date = new Date(Date.UTC(2024, month, 5 + fundIndex));
      const amount = 12000 + fundIndex * 2500 + month * 350;
      const nav = computeFundValue(fund, date, month * 3 + fundIndex);
      const units = round4(amount / nav);

      rows.push({
        user_id: userId,
        fund_id: fund.id,
        transaction_date: toIsoDate(date),
        transaction_type: 'purchase',
        units,
        nav_at_transaction: round4(nav),
        amount: round2(amount),
        folio_number: `DEMO-FOLIO-${fundIndex + 1}`,
      });
    }
  }

  rows.push({
    user_id: userId,
    fund_id: funds[0].id,
    transaction_date: '2025-10-10',
    transaction_type: 'redemption',
    units: 18.25,
    nav_at_transaction: round4(computeFundValue(funds[0], new Date('2025-10-10'), 99)),
    amount: 2350.75,
    folio_number: 'DEMO-FOLIO-1',
  });

  await mustSucceed(supabase.from('transaction').insert(rows));
}

async function seedNavHistory() {
  const rows = [];
  const dates = businessDatesBackFrom(new Date(), 950);

  for (const fund of DEMO_FUNDS) {
    dates.forEach((date, index) => {
      rows.push({
        scheme_code: fund.schemeCode,
        nav_date: toIsoDate(date),
        nav: round4(computeFundValue(fund, date, index)),
      });
    });
  }

  await batchUpsert('nav_history', rows, ['scheme_code', 'nav_date']);
}

async function seedIndexHistory() {
  const rows = [];
  const dates = businessDatesBackFrom(new Date(), 950);

  for (const indexDef of DEMO_INDEXES) {
    dates.forEach((date, index) => {
      rows.push({
        index_symbol: indexDef.symbol,
        index_name: indexDef.name,
        index_date: toIsoDate(date),
        close_value: round4(
          indexDef.baseline +
            indexDef.driftPerDay * index +
            Math.sin(index / 11) * indexDef.waveSize +
            Math.cos(index / 23) * (indexDef.waveSize / 2),
        ),
      });
    });
  }

  await batchUpsert('index_history', rows, ['index_symbol', 'index_date']);
}

async function batchUpsert(table, rows, conflictColumns) {
  const batchSize = 500;

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    await mustSucceed(
      supabase.from(table).upsert(batch, {
        onConflict: conflictColumns.join(','),
      }),
    );
  }
}

function businessDatesBackFrom(endDate, count) {
  const dates = [];
  const cursor = new Date(Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate(),
  ));

  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return dates.reverse();
}

function computeFundValue(fund, date, index) {
  const seasonal = Math.sin(index / 14) * fund.waveSize;
  const secondary = Math.cos(index / 29) * (fund.waveSize / 2.5);
  const trend = fund.baselineNav + fund.driftPerDay * index;
  const yearFactor = (date.getUTCFullYear() - 2023) * 0.35;
  return Math.max(10, trend + seasonal + secondary + yearFactor);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function round2(value) {
  return Number(value.toFixed(2));
}

function round4(value) {
  return Number(value.toFixed(4));
}

async function mustSucceed(promise) {
  const { error } = await promise;
  if (error) throw error;
}
