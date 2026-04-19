-- supabase/migrations/00023_sentry_notified_issues.sql
-- Table de déduplication pour les notifications Telegram d'issues Sentry critiques

CREATE TABLE IF NOT EXISTS public.sentry_notified_issues (
  issue_id   TEXT PRIMARY KEY,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
