-- Tables de sécurité pour telegram-webhook :
-- 1. pending_telegram_actions : confirmation avant send_email
-- 2. telegram_rate_limit : max 20 actions/heure/chat_id

-- ── pending_telegram_actions ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pending_telegram_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload     JSONB NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX pending_telegram_actions_chat_id_idx
  ON public.pending_telegram_actions (chat_id);

CREATE INDEX pending_telegram_actions_expires_at_idx
  ON public.pending_telegram_actions (expires_at);

ALTER TABLE public.pending_telegram_actions ENABLE ROW LEVEL SECURITY;
-- Pas de policy = uniquement service_role peut accéder

-- ── telegram_rate_limit ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.telegram_rate_limit (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id           TEXT NOT NULL,
  action_timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX telegram_rate_limit_chat_id_ts_idx
  ON public.telegram_rate_limit (chat_id, action_timestamp);

ALTER TABLE public.telegram_rate_limit ENABLE ROW LEVEL SECURITY;
-- Pas de policy = uniquement service_role peut accéder

-- Nettoyage automatique des entrées expirées (toutes les 15 min)
SELECT cron.schedule(
  'cleanup-telegram-security',
  '*/15 * * * *',
  $$
    DELETE FROM public.pending_telegram_actions WHERE expires_at < NOW();
    DELETE FROM public.telegram_rate_limit WHERE action_timestamp < NOW() - INTERVAL '2 hours';
  $$
);
