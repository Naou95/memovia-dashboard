-- Migration 00003: Paramètres partagés du dashboard (ex : seuil alerte Qonto)

CREATE TABLE IF NOT EXISTS public.dashboard_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Réutilise handle_updated_at() créé en migration 00001
CREATE TRIGGER dashboard_settings_updated_at
  BEFORE UPDATE ON public.dashboard_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.dashboard_settings ENABLE ROW LEVEL SECURITY;

-- Tous les admins authentifiés peuvent lire
CREATE POLICY "Authenticated can read settings"
  ON public.dashboard_settings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Tous les admins authentifiés peuvent écrire (INSERT, UPDATE, DELETE)
CREATE POLICY "Authenticated can upsert settings"
  ON public.dashboard_settings
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE ON public.dashboard_settings TO authenticated;
