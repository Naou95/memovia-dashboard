-- Migration 00004: Create contracts table
-- B2B contracts for MEMOVIA AI (écoles, CFA, entreprises)

CREATE TABLE IF NOT EXISTS public.contracts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name TEXT        NOT NULL,
  organization_type TEXT        NOT NULL CHECK (organization_type IN ('ecole', 'cfa', 'entreprise', 'autre')),
  status            TEXT        NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'negotiation', 'signe', 'actif', 'resilie')),
  license_count     INTEGER     NOT NULL DEFAULT 0,
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  mrr_eur           NUMERIC(10,2),
  renewal_date      DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        REFERENCES public.dashboard_profiles(id) ON DELETE SET NULL
);

-- Auto-update updated_at on row changes
-- NOTE: handle_updated_at() is already defined in migration 00001
DROP TRIGGER IF EXISTS contracts_updated_at ON public.contracts;
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can read all contracts
CREATE POLICY "Authenticated users can view contracts"
  ON public.contracts FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: authenticated users can create contracts
CREATE POLICY "Authenticated users can insert contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: authenticated users can update contracts
CREATE POLICY "Authenticated users can update contracts"
  ON public.contracts FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE: only admin_full can delete
CREATE POLICY "Admin full can delete contracts"
  ON public.contracts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_profiles
      WHERE id = auth.uid() AND role = 'admin_full'
    )
  );

-- Grant access to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;

-- Seed data: first MEMOVIA AI client
INSERT INTO public.contracts (organization_name, organization_type, status, license_count, contact_name, mrr_eur, renewal_date, notes)
SELECT 'CFA Compagnons du Devoir', 'cfa', 'actif', 30, 'Antoaneta', 360, '2026-09-01', 'Premier client MEMOVIA AI'
WHERE NOT EXISTS (
  SELECT 1 FROM public.contracts WHERE organization_name = 'CFA Compagnons du Devoir'
);
