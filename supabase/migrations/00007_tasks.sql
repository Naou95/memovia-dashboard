-- Migration 00007: Create tasks table
-- Module 7 — Tâches intelligentes (Kanban To do / En cours / Done)

CREATE TABLE IF NOT EXISTS public.tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  description  TEXT,
  status       TEXT        NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'en_cours', 'done')),
  priority     TEXT        NOT NULL DEFAULT 'normale' CHECK (priority IN ('haute', 'normale', 'basse')),
  due_date     DATE,
  assigned_to  TEXT        CHECK (assigned_to IN ('naoufel', 'emir')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        REFERENCES public.dashboard_profiles(id) ON DELETE SET NULL
);

-- Auto-update updated_at on row changes
-- NOTE: handle_updated_at() is already defined in migration 00001
DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can read all tasks
CREATE POLICY "Authenticated users can view tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: authenticated users can create tasks
CREATE POLICY "Authenticated users can insert tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: authenticated users can update tasks
CREATE POLICY "Authenticated users can update tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE: only admin_full can delete
CREATE POLICY "Admin full can delete tasks"
  ON public.tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_profiles
      WHERE id = auth.uid() AND role = 'admin_full'
    )
  );

-- Grant access to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;

-- Enable Realtime on tasks table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

-- Seed data: sample tasks
INSERT INTO public.tasks (title, description, status, priority, due_date, assigned_to)
SELECT
  'Préparer démo CFA Compagnons du Devoir',
  'Personnaliser la démo avec les formations bâtiment. Contacter Antoaneta en amont.',
  'en_cours', 'haute', '2026-04-22', 'naoufel'
WHERE NOT EXISTS (SELECT 1 FROM public.tasks WHERE title = 'Préparer démo CFA Compagnons du Devoir');

INSERT INTO public.tasks (title, description, status, priority, due_date, assigned_to)
SELECT
  'Finaliser dossier CRECE',
  'Compléter les sections financières et techniques du dossier de candidature.',
  'en_cours', 'haute', '2026-05-20', 'naoufel'
WHERE NOT EXISTS (SELECT 1 FROM public.tasks WHERE title = 'Finaliser dossier CRECE');

INSERT INTO public.tasks (title, description, status, priority, due_date, assigned_to)
SELECT
  'Contacter 5 nouveaux prospects LinkedIn',
  'Focus établissements scolaires région Occitanie.',
  'todo', 'normale', '2026-04-30', 'emir'
WHERE NOT EXISTS (SELECT 1 FROM public.tasks WHERE title = 'Contacter 5 nouveaux prospects LinkedIn');

INSERT INTO public.tasks (title, description, status, priority, assigned_to)
SELECT
  'Mettre à jour la page pricing memovia.io',
  'Refléter les nouveaux tarifs B2B et B2C.',
  'todo', 'basse', 'naoufel'
WHERE NOT EXISTS (SELECT 1 FROM public.tasks WHERE title = 'Mettre à jour la page pricing memovia.io');

INSERT INTO public.tasks (title, description, status, priority, assigned_to)
SELECT
  'Rédiger proposition commerciale CFA Bâtiment Pro',
  'Inclure ROI estimé, cas d''usage, tarif groupe.',
  'done', 'normale', 'emir'
WHERE NOT EXISTS (SELECT 1 FROM public.tasks WHERE title = 'Rédiger proposition commerciale CFA Bâtiment Pro');
