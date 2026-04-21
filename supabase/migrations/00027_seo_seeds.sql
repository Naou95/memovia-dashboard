-- ── SEO Seeds (default keywords for SEO strategy) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.seo_seeds (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword    text        NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.seo_seeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_manage_seo_seeds" ON public.seo_seeds
  FOR ALL USING (auth.role() = 'authenticated');

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
  seeds_hash        text        NOT NULL UNIQUE,
  suggestions_json  jsonb       NOT NULL,
  created_at        timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.seo_suggestions_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_manage_seo_suggestions_cache" ON public.seo_suggestions_cache
  FOR ALL USING (auth.role() = 'authenticated');
