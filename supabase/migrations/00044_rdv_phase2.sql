-- Refonte v2, Phase 2 (REFONT_PLAN.md) : RDV & comptes rendus.
-- Un RDV/appel = une fiche ; une fiche passée sans CR = état anormal (relancé par le
-- briefing Telegram). Audio uploadé dans le bucket privé rdv-audio → edge function
-- rdv-transcribe (Gladia + Gemini) → CR généré, éditable.

CREATE TABLE IF NOT EXISTS public.rdv (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  rdv_date timestamptz NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  gcal_event_id text,
  audio_path text,
  transcript text,
  cr text,
  cr_status text NOT NULL DEFAULT 'manquant' CHECK (cr_status IN ('manquant', 'en_cours', 'fait')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rdv ENABLE ROW LEVEL SECURITY;

-- Une seule policy admin (les policies permissives s'additionnent : ne pas élargir).
CREATE POLICY rdv_admin_all ON public.rdv
  FOR ALL TO authenticated
  USING (public.is_dashboard_admin(auth.uid()))
  WITH CHECK (public.is_dashboard_admin(auth.uid()));

REVOKE ALL ON public.rdv FROM anon;

-- Bucket privé pour les enregistrements. ⚠️ Les policies vivent sur storage.objects,
-- pas sur le bucket (piège bucket ≠ table).
INSERT INTO storage.buckets (id, name, public)
VALUES ('rdv-audio', 'rdv-audio', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY rdv_audio_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rdv-audio' AND public.is_dashboard_admin(auth.uid()));

CREATE POLICY rdv_audio_admin_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'rdv-audio' AND public.is_dashboard_admin(auth.uid()));

CREATE POLICY rdv_audio_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'rdv-audio' AND public.is_dashboard_admin(auth.uid()));
