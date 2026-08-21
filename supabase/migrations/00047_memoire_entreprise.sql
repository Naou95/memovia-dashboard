-- Migration 00047 : mémoire d'entreprise (spec docs/superpowers/specs/2026-08-21-memoire-entreprise-design.md).
-- 1) Partenaires dans `leads` : type 'partenaire' + status 'actif' (le cycle nouveau→perdu
--    n'a pas de sens pour Christelle/Compagnons, Paidea, TBS).
-- 2) Engagements : une tâche peut être liée à une fiche (tasks.lead_id).
-- 3) Historique produit : table product_milestones, alimentée par le cron changelog-collect
--    (candidats) + tri humain (retenu/écarté). source_url UNIQUE = clé de dédupe du cron.

ALTER TABLE public.leads DROP CONSTRAINT leads_type_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_type_check
  CHECK (type IN ('ecole', 'cfa', 'entreprise', 'autre', 'partenaire'));

ALTER TABLE public.leads DROP CONSTRAINT leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('nouveau', 'contacte', 'en_discussion', 'proposition', 'gagne', 'perdu', 'actif'));

ALTER TABLE public.tasks ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;
CREATE INDEX tasks_lead_id_idx ON public.tasks(lead_id) WHERE lead_id IS NOT NULL;

CREATE TABLE public.product_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  repo text NOT NULL,
  title text NOT NULL,
  detail text,
  source_url text UNIQUE,
  status text NOT NULL DEFAULT 'candidat' CHECK (status IN ('candidat', 'retenu', 'ecarte')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_milestones ENABLE ROW LEVEL SECURITY;

-- Une seule policy admin (les policies permissives s'additionnent : ne pas élargir) —
-- même pattern que financements (00045).
CREATE POLICY product_milestones_admin_all ON public.product_milestones
  FOR ALL TO authenticated
  USING (public.is_dashboard_admin(auth.uid()))
  WITH CHECK (public.is_dashboard_admin(auth.uid()));

REVOKE ALL ON public.product_milestones FROM anon;
