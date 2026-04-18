-- Fix Bug 1 : gestion admins — Emir Boutaleb invisible dans /admin
--
-- Deux problèmes :
--   1. La ligne dashboard_profiles d'Emir pointait vers une ancienne entrée
--      auth.users (boutaleb.emir@gmail.com) au lieu du compte réellement
--      utilisé (boutaleb.emir99@gmail.com).
--   2. La policy RLS « Users can read own profile » limitait chaque admin à
--      sa propre ligne, donc AdminPage ne pouvait jamais lister tous les
--      collaborateurs.
--
-- Fix : aligner la ligne Emir sur le bon auth user + nouvelle policy SELECT
-- basée sur un helper SECURITY DEFINER pour éviter la récursion RLS.

DELETE FROM public.dashboard_profiles
WHERE id = '859dab34-1ffa-4473-983b-d72d3a4742ad';

INSERT INTO public.dashboard_profiles (id, email, full_name, role)
VALUES (
  '78764138-f7a3-4cd0-b019-8703d8d4190a',
  'boutaleb.emir99@gmail.com',
  'Emir Boutaleb',
  'admin_bizdev'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.is_dashboard_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.dashboard_profiles WHERE id = uid);
$$;

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.dashboard_profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.dashboard_profiles
  FOR SELECT
  TO authenticated
  USING (public.is_dashboard_admin(auth.uid()));
