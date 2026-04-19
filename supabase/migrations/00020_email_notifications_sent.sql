-- Migration 00020: table email_notifications_sent + cron notify-new-email
-- Tracks Message-IDs already notified via Telegram to avoid duplicates.
-- Cron runs every 30 minutes to check for new unread emails.

CREATE TABLE IF NOT EXISTS email_notifications_sent (
  message_id  TEXT PRIMARY KEY,
  notified_at TIMESTAMPTZ DEFAULT now()
);

SELECT cron.schedule(
  'notify-new-email',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/notify-new-email',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
