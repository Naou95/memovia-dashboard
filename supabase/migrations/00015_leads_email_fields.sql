-- Migration 00015: Add email lead detection fields to leads
-- Supports automatic lead creation from incoming emails (email_auto source)
-- Fields: email_message_id (deduplication), contact_email, contact_name, source

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS email_message_id TEXT,
  ADD COLUMN IF NOT EXISTS contact_email     TEXT,
  ADD COLUMN IF NOT EXISTS contact_name      TEXT,
  ADD COLUMN IF NOT EXISTS source            TEXT DEFAULT 'manual';

-- Unique index on email_message_id for deduplication (partial: only non-NULL rows)
CREATE UNIQUE INDEX IF NOT EXISTS leads_email_message_id_unique
  ON public.leads (email_message_id)
  WHERE email_message_id IS NOT NULL;
