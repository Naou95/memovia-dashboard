-- ── Blog categories ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text        NOT NULL,
  slug        text        NOT NULL UNIQUE,
  description text,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_blog_categories" ON public.blog_categories
  FOR ALL USING (auth.role() = 'authenticated');

-- ── Blog articles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blog_articles (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title            text        NOT NULL,
  slug             text        NOT NULL UNIQUE,
  content          text        NOT NULL DEFAULT '',
  excerpt          text,
  keyword          text,
  status           text        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'published', 'archived')),
  category_id      uuid        REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  meta_title       text,
  meta_description text,
  reading_time     integer,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL,
  published_at     timestamptz
);

ALTER TABLE public.blog_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_blog_articles" ON public.blog_articles
  FOR ALL USING (auth.role() = 'authenticated');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS blog_articles_updated_at ON public.blog_articles;
CREATE TRIGGER blog_articles_updated_at
  BEFORE UPDATE ON public.blog_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
