-- Migration 00016: Schedule email-lead-detector via pg_cron
-- Runs every hour to scan IMAP and detect new leads automatically
-- Requires pg_cron and pg_net extensions (enabled by default on Supabase)
--
-- SETUP: Set the service role key in Supabase dashboard before activating:
--   ALTER DATABASE postgres SET "app.service_role_key" = '<your-service-role-key>';
-- OR configure the schedule directly in Supabase Dashboard > Edge Functions > email-lead-detector > Schedule

SELECT cron.schedule(
  'email-lead-detector-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url        := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/email-lead-detector',
    headers    := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
                  ),
    body       := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
