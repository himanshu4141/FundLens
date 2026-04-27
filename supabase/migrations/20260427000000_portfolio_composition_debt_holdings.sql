-- Add raw_debt_holdings column to fund_portfolio_composition.
--
-- Phase A (M12): the mfdata.in holdings API already returns debt instrument detail
-- (name, credit_rating, maturity_date, holding_type, weight_pct) for hybrid and
-- pure-debt funds. The sync function now captures this instead of discarding it.
-- This column is null for category_rules rows and for equity funds with no debt.

ALTER TABLE fund_portfolio_composition
  ADD COLUMN IF NOT EXISTS raw_debt_holdings JSONB;

COMMENT ON COLUMN fund_portfolio_composition.raw_debt_holdings IS
  'Debt and money market instrument detail from mfdata.in debt_holdings. '
  'Populated for source=''amfi'' rows when the fund has debt exposure and the '
  'holdings pass the corruption guard. Null for category_rules rows.';
