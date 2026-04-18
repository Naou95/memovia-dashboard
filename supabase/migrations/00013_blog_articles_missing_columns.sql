-- Fix Bug 3 : SEO & Blog — brouillon/publication silencieux
--
-- La table blog_articles (créée à l'origine pour le site memovia.io) ne
-- contenait pas les colonnes attendues par l'Edge Function seo-articles
-- (excerpt, keyword, meta_title, reading_time, updated_at). Chaque appel
-- create/publish/list échouait côté Postgres avec "column does not exist"
-- → le dashboard affichait un toast d'erreur sans explication.

ALTER TABLE public.blog_articles
  ADD COLUMN IF NOT EXISTS excerpt text,
  ADD COLUMN IF NOT EXISTS keyword text,
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS reading_time integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.blog_articles_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS blog_articles_set_updated_at ON public.blog_articles;
CREATE TRIGGER blog_articles_set_updated_at
  BEFORE UPDATE ON public.blog_articles
  FOR EACH ROW EXECUTE FUNCTION public.blog_articles_touch_updated_at();
