-- supabase/migrations/00017_leads_maturity_fields.sql
-- Ajout des colonnes de maturité conversationnelle sur leads

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contact_role      TEXT,
  ADD COLUMN IF NOT EXISTS maturity          TEXT DEFAULT 'froid'
    CHECK (maturity IN ('froid', 'tiede', 'chaud')),
  ADD COLUMN IF NOT EXISTS relance_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contact_date DATE,
  ADD COLUMN IF NOT EXISTS timeline          JSONB;
