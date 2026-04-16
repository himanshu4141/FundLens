-- Add fund technical metadata columns
-- Data populated by sync-fund-meta edge function (on-demand, not cron)
ALTER TABLE fund ADD COLUMN IF NOT EXISTS isin TEXT;
ALTER TABLE fund ADD COLUMN IF NOT EXISTS expense_ratio DECIMAL(6,4);
ALTER TABLE fund ADD COLUMN IF NOT EXISTS aum_cr DECIMAL(12,2);
ALTER TABLE fund ADD COLUMN IF NOT EXISTS min_sip_amount INTEGER;
ALTER TABLE fund ADD COLUMN IF NOT EXISTS fund_meta_synced_at TIMESTAMPTZ;
