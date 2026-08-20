-- Refonte v2, Phase 3 (REFONT_PLAN.md) : Financements & concours.
-- Système d'enregistrement : « où on en est, quand postuler, on fait quoi concrètement ».
-- Les deadlines à moins de 14 jours remontent dans le briefing Telegram quotidien.

CREATE TABLE IF NOT EXISTS public.financements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'concours' CHECK (type IN ('concours', 'subvention', 'pret', 'autre')),
  status text NOT NULL DEFAULT 'veille'
    CHECK (status IN ('veille', 'a_deposer', 'depose', 'jury', 'gagne', 'perdu', 'abandonne')),
  deadline date,
  next_action text,
  assigned_to text CHECK (assigned_to IN ('naoufel', 'emir')),
  notes text,
  url text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financements ENABLE ROW LEVEL SECURITY;

-- Une seule policy admin (les policies permissives s'additionnent : ne pas élargir).
CREATE POLICY financements_admin_all ON public.financements
  FOR ALL TO authenticated
  USING (public.is_dashboard_admin(auth.uid()))
  WITH CHECK (public.is_dashboard_admin(auth.uid()));

REVOKE ALL ON public.financements FROM anon;

-- Seed : uniquement des faits vérifiés au 20/08/2026 (vault 01-now/now.md).
INSERT INTO public.financements (name, type, status, deadline, next_action, assigned_to, notes)
VALUES
  (
    'Handitech Trophy — 2143-Emploi',
    'concours',
    'a_deposer',
    '2026-09-01',
    'Tourner la vidéo (< 1 min 30) après le RDV Petrache, puis déposer tôt et corriger ensuite',
    'naoufel',
    'Brouillon complet en ligne, il ne manque que la vidéo. Jury en ligne 14-15/09. Si finaliste : 13/10 à Paris + 16/11 remise des prix (présence obligatoire).'
  ),
  (
    'Agefiph — AMI Handinnov',
    'subvention',
    'veille',
    NULL,
    'Qualifier l''éligibilité et la deadline exacte',
    'naoufel',
    'Évaluée le 20/08/2026, à qualifier avant d''engager du temps.'
  ),
  (
    'Prêts d''honneur (Initiative / Réseau Entreprendre)',
    'pret',
    'veille',
    NULL,
    'Identifier l''antenne locale et le calendrier de passage en comité',
    'naoufel',
    'Gisement principal identifié avec les concours cash (les subventions classiques sont KO).'
  );
