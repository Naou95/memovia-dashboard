-- Migration 00006: Create leads table
-- CRM / Prospection pipeline for MEMOVIA AI

CREATE TABLE IF NOT EXISTS public.leads (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  type          TEXT        NOT NULL DEFAULT 'autre' CHECK (type IN ('ecole', 'cfa', 'entreprise', 'autre')),
  canal         TEXT        NOT NULL DEFAULT 'autre' CHECK (canal IN ('linkedin', 'email', 'referral', 'appel', 'autre')),
  status        TEXT        NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'contacte', 'en_discussion', 'proposition', 'gagne', 'perdu')),
  next_action   TEXT,
  follow_up_date DATE,
  assigned_to   TEXT        CHECK (assigned_to IN ('naoufel', 'emir')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID        REFERENCES public.dashboard_profiles(id) ON DELETE SET NULL
);

-- Auto-update updated_at on row changes
-- NOTE: handle_updated_at() is already defined in migration 00001
DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can read all leads
CREATE POLICY "Authenticated users can view leads"
  ON public.leads FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: authenticated users can create leads
CREATE POLICY "Authenticated users can insert leads"
  ON public.leads FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: authenticated users can update leads
CREATE POLICY "Authenticated users can update leads"
  ON public.leads FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE: only admin_full can delete
CREATE POLICY "Admin full can delete leads"
  ON public.leads FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_profiles
      WHERE id = auth.uid() AND role = 'admin_full'
    )
  );

-- Grant access to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;

-- Seed data: sample leads
INSERT INTO public.leads (name, type, canal, status, next_action, follow_up_date, assigned_to, notes)
SELECT 'Lycée Jean Moulin', 'ecole', 'linkedin', 'en_discussion', 'Envoyer démo personnalisée', '2026-04-25', 'naoufel', 'Contact : Mme Dupont, CPE'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE name = 'Lycée Jean Moulin');

INSERT INTO public.leads (name, type, canal, status, next_action, follow_up_date, assigned_to, notes)
SELECT 'CFA Bâtiment Pro', 'cfa', 'referral', 'contacte', 'Rappel téléphonique', '2026-04-20', 'emir', 'Référé par CFA Compagnons du Devoir'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE name = 'CFA Bâtiment Pro');

INSERT INTO public.leads (name, type, canal, status, assigned_to)
SELECT 'Académie des Métiers', 'cfa', 'email', 'nouveau', 'naoufel'
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE name = 'Académie des Métiers');
