-- Migration 00010: Roadmap & Feedback
-- Module 11 — feedback_items (idées/demandes) + feedback_votes (votes utilisateurs)

CREATE TABLE IF NOT EXISTS public.feedback_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  description  TEXT,
  status       TEXT        NOT NULL DEFAULT 'backlog'
                           CHECK (status IN ('backlog', 'planifie', 'en_dev', 'livre')),
  category     TEXT        NOT NULL DEFAULT 'fonctionnalite'
                           CHECK (category IN ('fonctionnalite', 'bug', 'amelioration')),
  author_name  TEXT,
  author_email TEXT,
  created_by   UUID        REFERENCES public.dashboard_profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS feedback_items_updated_at ON public.feedback_items;
CREATE TRIGGER feedback_items_updated_at
  BEFORE UPDATE ON public.feedback_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.feedback_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view feedback items"
  ON public.feedback_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert feedback items"
  ON public.feedback_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboard_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update feedback items"
  ON public.feedback_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_profiles
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboard_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin full can delete feedback items"
  ON public.feedback_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_profiles
      WHERE id = auth.uid() AND role = 'admin_full'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_items TO authenticated;

-- ─── feedback_votes ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.feedback_votes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID        NOT NULL REFERENCES public.feedback_items(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, user_id)
);

ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view votes"
  ON public.feedback_votes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can vote"
  ON public.feedback_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own vote"
  ON public.feedback_votes FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.feedback_votes TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_votes;

-- Seed data
INSERT INTO public.feedback_items (title, description, status, category, author_name)
SELECT 'Mode hors-ligne pour les apprenants', 'Pouvoir continuer les exercices sans connexion internet.', 'planifie', 'fonctionnalite', 'Naoufel'
WHERE NOT EXISTS (SELECT 1 FROM public.feedback_items WHERE title = 'Mode hors-ligne pour les apprenants');

INSERT INTO public.feedback_items (title, description, status, category, author_name)
SELECT 'Tableau de bord enseignant amélioré', 'Afficher la progression de chaque apprenant par compétence.', 'en_dev', 'fonctionnalite', 'Emir'
WHERE NOT EXISTS (SELECT 1 FROM public.feedback_items WHERE title = 'Tableau de bord enseignant amélioré');

INSERT INTO public.feedback_items (title, description, status, category, author_name)
SELECT 'Notifications email hebdomadaires', 'Récap des progrès envoyé chaque lundi aux apprenants.', 'backlog', 'amelioration', 'Naoufel'
WHERE NOT EXISTS (SELECT 1 FROM public.feedback_items WHERE title = 'Notifications email hebdomadaires');

INSERT INTO public.feedback_items (title, description, status, category, author_name)
SELECT 'Export PDF des certificats', 'Télécharger un certificat de complétion en PDF.', 'livre', 'fonctionnalite', 'Emir'
WHERE NOT EXISTS (SELECT 1 FROM public.feedback_items WHERE title = 'Export PDF des certificats');

INSERT INTO public.feedback_items (title, description, status, category, author_name)
SELECT 'Bug : video ne charge pas sur Safari iOS', 'Les vidéos MP4 restent bloquées sur l''écran de chargement.', 'en_dev', 'bug', 'Naoufel'
WHERE NOT EXISTS (SELECT 1 FROM public.feedback_items WHERE title = 'Bug : video ne charge pas sur Safari iOS');

INSERT INTO public.feedback_items (title, description, status, category, author_name)
SELECT 'Intégration Google Classroom', 'Synchroniser les classes et devoirs avec Google Classroom.', 'backlog', 'fonctionnalite', 'Naoufel'
WHERE NOT EXISTS (SELECT 1 FROM public.feedback_items WHERE title = 'Intégration Google Classroom');
