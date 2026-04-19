-- Portfolio composition snapshots: per-scheme, per-month
-- Populated by sync-fund-portfolios edge function.
-- Two sources: 'category_rules' (instant approximation from SEBI framework)
--              'amfi' (actual monthly disclosure data)
-- The UI prefers 'amfi' when available, falls back to 'category_rules'.

CREATE TABLE fund_portfolio_composition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_code INTEGER NOT NULL,
  portfolio_date DATE NOT NULL,       -- last day of disclosure month; CURRENT_DATE for category_rules
  -- Asset allocation (% of total fund NAV, should sum to ~100)
  equity_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
  debt_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
  cash_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
  other_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
  -- Market cap breakdown (% of equity portion; remainder is not_classified)
  large_cap_pct DECIMAL(6,2),
  mid_cap_pct DECIMAL(6,2),
  small_cap_pct DECIMAL(6,2),
  not_classified_pct DECIMAL(6,2),
  -- Rich data: only set for source='amfi'; null for category_rules rows
  sector_allocation JSONB,            -- {"Financial": 32.5, "Technology": 6.0, ...}
  top_holdings JSONB,                 -- [{name, isin, sector, market_cap, pct_of_nav}]
  source TEXT NOT NULL DEFAULT 'category_rules', -- 'category_rules' | 'amfi'
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scheme_code, portfolio_date, source)
);

CREATE INDEX idx_fpc_scheme_date ON fund_portfolio_composition (scheme_code, portfolio_date DESC);

-- Global reference data: all authenticated users may read, only service role may write
ALTER TABLE fund_portfolio_composition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read fund_portfolio_composition"
  ON fund_portfolio_composition
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service role has full access to fund_portfolio_composition"
  ON fund_portfolio_composition
  FOR ALL
  TO service_role
  USING (true);
