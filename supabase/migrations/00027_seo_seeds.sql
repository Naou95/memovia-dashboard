-- ── SEO Seeds (default keywords for SEO strategy) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.seo_seeds (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword    text        NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.seo_seeds ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can read all seo_seeds
CREATE POLICY "Authenticated users can view seo_seeds"
  ON public.seo_seeds FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: authenticated users can create seo_seeds
CREATE POLICY "Authenticated users can insert seo_seeds"
  ON public.seo_seeds FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: authenticated users can update seo_seeds
CREATE POLICY "Authenticated users can update seo_seeds"
  ON public.seo_seeds FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE: authenticated users can delete seo_seeds
CREATE POLICY "Authenticated users can delete seo_seeds"
  ON public.seo_seeds FOR DELETE
  USING (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_seeds TO authenticated;

-- Auto-update updated_at on row changes (reuses set_updated_at() from 00011_blog.sql)
DROP TRIGGER IF EXISTS seo_seeds_updated_at ON public.seo_seeds;
CREATE TRIGGER seo_seeds_updated_at
  BEFORE UPDATE ON public.seo_seeds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Insert default SEO seed keywords
INSERT INTO public.seo_seeds (keyword) VALUES
  ('logiciel CFA'),
  ('IA formation professionnelle'),
  ('contenu pédagogique automatique'),
  ('quiz formation'),
  ('outil formateur'),
  ('apprentissage CFA'),
  ('plateforme formation IA'),
  ('générateur quiz IA'),
  ('fiche de révision automatique')
ON CONFLICT (keyword) DO NOTHING;

-- ── SEO Suggestions Cache (cached AI-generated suggestions based on seed keywords) ──
CREATE TABLE IF NOT EXISTS public.seo_suggestions_cache (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  seeds_hash        text        NOT NULL UNIQUE, -- SHA-256 of sorted comma-joined seed keywords
  suggestions_json  jsonb       NOT NULL,
  created_at        timestamptz DEFAULT now() NOT NULL,
  expires_at        timestamptz
);

ALTER TABLE public.seo_suggestions_cache ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can read all seo_suggestions_cache
CREATE POLICY "Authenticated users can view seo_suggestions_cache"
  ON public.seo_suggestions_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: authenticated users can create seo_suggestions_cache entries
CREATE POLICY "Authenticated users can insert seo_suggestions_cache"
  ON public.seo_suggestions_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: authenticated users can update seo_suggestions_cache entries
CREATE POLICY "Authenticated users can update seo_suggestions_cache"
  ON public.seo_suggestions_cache FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE: authenticated users can delete seo_suggestions_cache entries
CREATE POLICY "Authenticated users can delete seo_suggestions_cache"
  ON public.seo_suggestions_cache FOR DELETE
  USING (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_suggestions_cache TO authenticated;
