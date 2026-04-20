-- Migration 00025: Add is_private field to tasks
-- Tâches privées : visibles uniquement par leur créateur si is_private = true

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- created_by existe déjà avec FK sur dashboard_profiles
-- On s'assure que le type correspond à auth.uid()
-- (dashboard_profiles.id = auth.users.id par convention Supabase)

-- Mettre à jour la policy SELECT pour filtrer les tâches privées
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON public.tasks;

CREATE POLICY "Authenticated users can view tasks"
  ON public.tasks FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      is_private = false
      OR created_by = auth.uid()
    )
  );
