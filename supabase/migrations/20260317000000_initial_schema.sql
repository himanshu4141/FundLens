-- ============================================================
-- FundLens initial schema
-- ============================================================
-- Conventions:
--   - All user-owned tables have user_id + RLS enabled
--   - Global/reference tables (nav_history, index_history, benchmark_mapping)
--     are readable by any authenticated user
--   - UUIDs for PKs, gen_random_uuid() as default
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- Enums
-- ============================================================

create type transaction_type as enum (
  'purchase',
  'redemption',
  'switch_in',
  'switch_out',
  'dividend_reinvest'
);

create type import_source as enum ('email', 'qr', 'pdf');
create type import_status as enum ('pending', 'success', 'failed');

-- ============================================================
-- User-owned tables
-- ============================================================

-- fund: one row per mutual fund per user
create table fund (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  scheme_code            integer not null,
  scheme_name            text not null,
  scheme_category        text not null,
  benchmark_index        text,
  benchmark_index_symbol text,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, scheme_code)
);

alter table fund enable row level security;

create policy "Users can manage their own funds"
  on fund for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- transaction: individual buy/sell/switch events
create table transaction (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  fund_id            uuid not null references fund(id) on delete cascade,
  transaction_date   date not null,
  transaction_type   transaction_type not null,
  units              numeric(18, 4) not null,
  nav_at_transaction numeric(18, 4) not null,
  amount             numeric(18, 2) not null,
  folio_number       text,
  cas_import_id      uuid,
  created_at         timestamptz not null default now(),
  unique (fund_id, transaction_date, transaction_type, units, amount)
);

alter table transaction enable row level security;

create policy "Users can manage their own transactions"
  on transaction for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- cas_import: audit log of each CAS import attempt
create table cas_import (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  import_source       import_source not null,
  import_status       import_status not null default 'pending',
  imported_at         timestamptz not null default now(),
  funds_updated       integer not null default 0,
  transactions_added  integer not null default 0,
  raw_payload         jsonb,
  error_message       text,
  created_at          timestamptz not null default now()
);

alter table cas_import enable row level security;

create policy "Users can manage their own imports"
  on cas_import for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Back-reference FK from transaction → cas_import (after both tables exist)
alter table transaction
  add constraint transaction_cas_import_fk
  foreign key (cas_import_id) references cas_import(id) on delete set null;

-- ============================================================
-- Global / shared tables (no user_id — shared across all users)
-- ============================================================

-- nav_history: daily NAV per scheme (scheme-level, not per-user)
create table nav_history (
  id          uuid primary key default gen_random_uuid(),
  scheme_code integer not null,
  nav_date    date not null,
  nav         numeric(18, 4) not null,
  created_at  timestamptz not null default now(),
  unique (scheme_code, nav_date)
);

alter table nav_history enable row level security;

create policy "Authenticated users can read NAV history"
  on nav_history for select
  using (auth.role() = 'authenticated');

create policy "Service role can upsert NAV history"
  on nav_history for insert
  with check (true);

create policy "Service role can update NAV history"
  on nav_history for update
  using (true);

-- index_history: daily benchmark index values
create table index_history (
  id           uuid primary key default gen_random_uuid(),
  index_symbol text not null,
  index_name   text not null,
  index_date   date not null,
  close_value  numeric(18, 4) not null,
  created_at   timestamptz not null default now(),
  unique (index_symbol, index_date)
);

alter table index_history enable row level security;

create policy "Authenticated users can read index history"
  on index_history for select
  using (auth.role() = 'authenticated');

create policy "Service role can upsert index history"
  on index_history for insert
  with check (true);

create policy "Service role can update index history"
  on index_history for update
  using (true);

-- benchmark_mapping: maps scheme category → benchmark index
create table benchmark_mapping (
  id                     uuid primary key default gen_random_uuid(),
  scheme_category        text not null,
  benchmark_index        text not null,
  benchmark_index_symbol text not null,
  valid_from             date not null default '2000-01-01'
);

alter table benchmark_mapping enable row level security;

create policy "Authenticated users can read benchmark mapping"
  on benchmark_mapping for select
  using (auth.role() = 'authenticated');

-- Seed benchmark_mapping with standard AMFI category → benchmark mappings
insert into benchmark_mapping (scheme_category, benchmark_index, benchmark_index_symbol) values
  ('Large Cap Fund', 'Nifty 100 TRI', '^NIFTY100'),
  ('Mid Cap Fund', 'Nifty Midcap 150 TRI', '^NIFTYMIDCAP150'),
  ('Small Cap Fund', 'Nifty Smallcap 250 TRI', '^NIFTYSMALLCAP250'),
  ('Flexi Cap Fund', 'Nifty 500 TRI', '^NIFTY500'),
  ('Multi Cap Fund', 'Nifty 500 TRI', '^NIFTY500'),
  ('Large & Mid Cap Fund', 'Nifty LargeMidcap 250 TRI', '^NIFTYLMI250'),
  ('ELSS', 'Nifty 500 TRI', '^NIFTY500'),
  ('Focused Fund', 'Nifty 500 TRI', '^NIFTY500'),
  ('Value Fund', 'Nifty 500 TRI', '^NIFTY500'),
  ('Contra Fund', 'Nifty 500 TRI', '^NIFTY500'),
  ('Sectoral/Thematic Fund', 'Nifty 500 TRI', '^NIFTY500'),
  ('Index Fund', 'Nifty 50 TRI', '^NSEI'),
  ('ETF', 'Nifty 50 TRI', '^NSEI'),
  ('Overnight Fund', 'NIFTY 1D Rate Index', '^NIFTY1D'),
  ('Liquid Fund', 'Nifty Liquid Index', '^NIFTYLIQUID'),
  ('Ultra Short Duration Fund', 'Crisil Ultra Short Term Debt Index', 'CRISILUST'),
  ('Low Duration Fund', 'Crisil Low Duration Debt Index', 'CRISILLD'),
  ('Short Duration Fund', 'Crisil Short Duration Debt Index', 'CRISILSD'),
  ('Medium Duration Fund', 'Crisil Medium Duration Debt Index', 'CRISILMD'),
  ('Long Duration Fund', 'Crisil Long Duration Debt Index', 'CRISILLONG'),
  ('Gilt Fund', 'Crisil Dynamic Gilt Index', 'CRISILDG'),
  ('Aggressive Hybrid Fund', 'Nifty 50 Hybrid Composite Debt 65:35 Index', '^NIFTYHYBRID6535'),
  ('Conservative Hybrid Fund', 'Crisil Hybrid 25+75 Conservative Index', 'CRISILHYBRID2575'),
  ('Balanced Advantage Fund', 'Nifty 50 TRI', '^NSEI'),
  ('Arbitrage Fund', 'Nifty 50 Arbitrage Index', '^NIFTYARB');

-- ============================================================
-- Indexes for performance
-- ============================================================

create index idx_fund_user_id on fund(user_id);
create index idx_transaction_user_id on transaction(user_id);
create index idx_transaction_fund_id on transaction(fund_id);
create index idx_transaction_date on transaction(transaction_date);
create index idx_cas_import_user_id on cas_import(user_id);
create index idx_nav_history_scheme_code on nav_history(scheme_code);
create index idx_nav_history_nav_date on nav_history(nav_date desc);
create index idx_index_history_symbol on index_history(index_symbol);
create index idx_index_history_date on index_history(index_date desc);
create index idx_benchmark_mapping_category on benchmark_mapping(scheme_category);

-- ============================================================
-- updated_at trigger for fund table
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger fund_set_updated_at
  before update on fund
  for each row execute function set_updated_at();
