-- Refonte v2, Phase 1 (REFONT_PLAN.md) : leads CFA France + log d'appels.
-- 1. Flag archived : la liste pré-refonte ne colle plus à la stratégie (décision 20/08/2026),
--    on archive tout (réversible en un clic dans l'UI, jamais de delete).
-- 2. contact_phone : indispensable à la prospection téléphonique, absent du schéma initial.
-- 3. lead_calls : log d'appel en < 30 s (issue, note, horodatage auto).
-- 4. Script d'appel + docs partagés dans dashboard_settings (éditables dans l'UI).

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contact_phone text;

CREATE TABLE IF NOT EXISTS public.lead_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('repondu', 'pas_repondu', 'rappel')),
  note text,
  called_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);

ALTER TABLE public.lead_calls ENABLE ROW LEVEL SECURITY;

-- Une seule policy admin (les policies permissives s'additionnent : ne pas élargir).
CREATE POLICY lead_calls_admin_all ON public.lead_calls
  FOR ALL TO authenticated
  USING (public.is_dashboard_admin(auth.uid()))
  WITH CHECK (public.is_dashboard_admin(auth.uid()));

REVOKE ALL ON public.lead_calls FROM anon;

-- Archivage de la liste pré-refonte (11 leads au 20/08/2026).
UPDATE public.leads SET archived = true WHERE archived = false;

-- Script d'appel + docs de vente partagés. Contenu à rédiger dans l'UI — squelette seulement,
-- aucune affirmation commerciale n'est pré-remplie ici.
INSERT INTO public.dashboard_settings (key, value) VALUES
  ('leads_script', '# Script d''appel — CFA France (offre accessibilité)

## Ouverture

_(à rédiger)_

## Questions de qualification

_(à rédiger)_

## Objections courantes

_(à rédiger)_

## Prochaine étape à verrouiller

_(à rédiger)_'),
  ('leads_docs', '_Aucun document ajouté. Une ligne par doc : `- [Nom du doc](https://…)`_')
ON CONFLICT (key) DO NOTHING;
