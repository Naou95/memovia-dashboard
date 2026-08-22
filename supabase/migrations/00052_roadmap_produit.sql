-- Roadmap produit (22/08/2026) : le kanban de ce qu'on construit et POURQUOI.
-- Colonnes = horizon (maintenant / ensuite / plus tard / parqué), jamais des dates :
-- la roadmap se déplace à la main quand la réalité bouge, elle ne se planifie pas.
-- Vivait en dur dans PositionnementPage — donc morte entre deux sessions.
CREATE TABLE IF NOT EXISTS public.roadmap_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  why text,
  horizon text NOT NULL DEFAULT 'plus_tard'
    CHECK (horizon IN ('maintenant', 'ensuite', 'plus_tard', 'parque')),
  tag text,
  ordre int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS roadmap_items_horizon_ordre_idx
  ON public.roadmap_items (horizon, ordre);

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

-- Une seule policy admin (les policies permissives s'additionnent : ne pas élargir).
CREATE POLICY roadmap_items_admin_all ON public.roadmap_items
  FOR ALL TO authenticated
  USING (public.is_dashboard_admin(auth.uid()))
  WITH CHECK (public.is_dashboard_admin(auth.uid()));

REVOKE ALL ON public.roadmap_items FROM anon;

-- Les 8 premières lignes ont été reprises telles quelles depuis le tableau en dur
-- de PositionnementPage (avec leur « pourquoi ») et insérées le 22/08/2026 :
-- données, pas schéma — elles ne sont pas rejouées ici.
