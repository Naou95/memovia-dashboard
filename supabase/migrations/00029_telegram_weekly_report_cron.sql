-- Migration 00029: Telegram weekly report via pg_cron
-- Sends a weekly business report to Naoufel every Monday at 6h00 UTC (= 8h Paris CEST / 7h CET)
--
-- PREREQUISITE (run once on the remote database if not already set):
--   ALTER DATABASE postgres SET "app.service_role_key" = '<your-service-role-key>';
--
-- Requires pg_cron and pg_net extensions (enabled by default on Supabase).

SELECT cron.schedule(
  'telegram-weekly-report',
  '0 6 * * 1',
  $$
  SELECT net.http_post(
    url        := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/telegram-weekly-report',
    headers    := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
                  ),
    body       := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
