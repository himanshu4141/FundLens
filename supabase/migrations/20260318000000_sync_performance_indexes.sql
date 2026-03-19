-- Additional indexes for sync-nav and sync-index query patterns
-- and for portfolio computation queries used in Milestones 4+

-- Composite index for fast NAV lookups (scheme + descending date → "latest NAV")
create index if not exists idx_nav_history_scheme_date
  on nav_history(scheme_code, nav_date desc);

-- Composite index for fast index lookups (symbol + descending date → "latest close")
create index if not exists idx_index_history_symbol_date
  on index_history(index_symbol, index_date desc);

-- Speed up "get all active funds for a user" query (home screen)
create index if not exists idx_fund_user_active
  on fund(user_id, is_active)
  where is_active = true;

-- Speed up transaction queries by fund+date (XIRR cashflow fetch)
create index if not exists idx_transaction_fund_date
  on transaction(fund_id, transaction_date asc);

-- Speed up "all transactions for user ordered by date" (portfolio XIRR)
create index if not exists idx_transaction_user_date
  on transaction(user_id, transaction_date asc);
