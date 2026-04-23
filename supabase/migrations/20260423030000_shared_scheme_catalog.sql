-- Split shared scheme metadata from user-owned holdings.
--
-- Why:
-- - `fund` currently mixes user portfolio membership with global scheme metadata.
-- - Deleting a user cascades their `fund` rows, which discards shared scheme data.
-- - NAV / composition / metadata syncs already deduplicate scheme codes in code, which
--   is a sign the database model is doing extra repeated work.
--
-- This migration:
-- 1. Renames the physical user-owned table to `user_fund`
-- 2. Creates a global `scheme_master` table keyed by `scheme_code`
-- 3. Backfills shared scheme data from existing rows
-- 4. Drops duplicated shared columns from `user_fund`
-- 5. Recreates `fund` as a read-only compatibility view so existing read queries keep working
-- 6. Captures additional mfdata.in fields we want for future product work:
--    - family linkage / related variants
--    - declared benchmark label
--    - risk label
--    - Morningstar rating

alter table fund rename to user_fund;

create table scheme_master (
  scheme_code              integer primary key,
  scheme_name              text not null,
  scheme_category          text not null,
  benchmark_index          text,
  benchmark_index_symbol   text,
  isin                     text,
  expense_ratio            decimal(6,4),
  aum_cr                   decimal(12,2),
  min_sip_amount           integer,
  fund_meta_synced_at      timestamptz,
  mfdata_family_id         integer,
  declared_benchmark_name  text,
  risk_label               text,
  morningstar_rating       integer,
  related_variants         jsonb,
  mfdata_meta_synced_at    timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

insert into scheme_master (
  scheme_code,
  scheme_name,
  scheme_category,
  benchmark_index,
  benchmark_index_symbol,
  isin,
  expense_ratio,
  aum_cr,
  min_sip_amount,
  fund_meta_synced_at
)
select distinct on (scheme_code)
  scheme_code,
  scheme_name,
  scheme_category,
  benchmark_index,
  benchmark_index_symbol,
  isin,
  expense_ratio,
  aum_cr,
  min_sip_amount,
  fund_meta_synced_at
from user_fund
order by scheme_code, fund_meta_synced_at desc nulls last, updated_at desc;

alter table scheme_master enable row level security;

create policy "Authenticated users can read scheme master"
  on scheme_master for select
  using (auth.role() = 'authenticated');

create policy "Service role can manage scheme master"
  on scheme_master for all
  to service_role
  using (true)
  with check (true);

create trigger scheme_master_set_updated_at
  before update on scheme_master
  for each row execute function set_updated_at();

alter table user_fund
  add constraint user_fund_scheme_code_fk
  foreign key (scheme_code) references scheme_master(scheme_code) on delete restrict;

create index if not exists idx_user_fund_scheme_code on user_fund(scheme_code);

create index if not exists idx_user_fund_active_scheme_code
  on user_fund(scheme_code)
  where is_active = true;

create index if not exists idx_scheme_master_category on scheme_master(scheme_category);
create index if not exists idx_scheme_master_benchmark_symbol on scheme_master(benchmark_index_symbol);
create index if not exists idx_scheme_master_family_id on scheme_master(mfdata_family_id);

alter table user_fund
  drop column scheme_name,
  drop column scheme_category,
  drop column benchmark_index,
  drop column benchmark_index_symbol,
  drop column isin,
  drop column expense_ratio,
  drop column aum_cr,
  drop column min_sip_amount,
  drop column fund_meta_synced_at;

create view fund
with (security_invoker = true)
as
select
  uf.id,
  uf.user_id,
  uf.scheme_code,
  sm.scheme_name,
  sm.scheme_category,
  sm.benchmark_index,
  sm.benchmark_index_symbol,
  uf.is_active,
  uf.created_at,
  uf.updated_at,
  sm.isin,
  sm.expense_ratio,
  sm.aum_cr,
  sm.min_sip_amount,
  sm.fund_meta_synced_at,
  sm.mfdata_family_id,
  sm.declared_benchmark_name,
  sm.risk_label,
  sm.morningstar_rating,
  sm.related_variants,
  sm.mfdata_meta_synced_at
from user_fund uf
join scheme_master sm using (scheme_code);
