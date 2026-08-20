-- Refonte v2 (REFONT_PLAN.md, Phase 0) : compteur de visites par section.
-- Critère de kill : une section ouverte < 3 fois/semaine pendant 4 semaines est supprimée.
-- Une ligne = une ouverture de section par un admin du dashboard.

CREATE TABLE IF NOT EXISTS public.section_visits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  visited_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.section_visits ENABLE ROW LEVEL SECURITY;

-- Une seule policy, restreinte aux admins dashboard (les policies permissives
-- s'additionnent : ne jamais en ajouter une plus large sur cette table).
CREATE POLICY section_visits_admin_all ON public.section_visits
  FOR ALL TO authenticated
  USING (public.is_dashboard_admin(auth.uid()))
  WITH CHECK (public.is_dashboard_admin(auth.uid()));

REVOKE ALL ON public.section_visits FROM anon;
