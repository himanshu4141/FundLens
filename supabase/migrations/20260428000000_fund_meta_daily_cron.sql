-- Daily cron for fund metadata sync.
--
-- sync-fund-meta fetches expense_ratio, AUM, ISIN, and other scheme-level
-- metadata from mfdata.in. It internally skips schemes synced within 7 days,
-- so the job is cheap on most runs — only newly added schemes or those whose
-- window has expired are processed.
--
-- Schedule: 2am daily. Runs every day (not weekday-only) so a newly imported
-- fund waits at most 24 hours for its Technical Details card to populate.

SELECT cron.schedule(
  'sync-fund-meta-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://imkgazlrxtlhkfptkzjc.supabase.co/functions/v1/sync-fund-meta',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
