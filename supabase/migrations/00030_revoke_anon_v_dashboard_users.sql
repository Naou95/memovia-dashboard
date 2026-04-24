-- Révoquer l'accès anon à v_dashboard_users (RGPD / PII exposure)
-- La clé anon est publique dans le JS frontend — tout le monde pouvait
-- lire les emails, plans et last_sign_in_at de tous les utilisateurs.

-- Recréer la vue avec filtre dashboard_profiles.
-- auth.uid() IS NULL → service_role / Edge Functions (pas de JWT) : tout passe.
-- auth.uid() IS NOT NULL → authenticated : seuls les admins dashboard voient les données.
-- Les users authentifiés de app.memovia.io sans profil dashboard reçoivent zéro lignes.
CREATE OR REPLACE VIEW public.v_dashboard_users AS
SELECT
  p.user_id                       AS id,
  u.email,
  p.first_name,
  p.last_name,
  p.plan,
  p.account_type,
  p.subscription_status,
  p.subscription_price_family,
  p.organization_id,
  o.name                          AS organization_name,
  p.created_at,
  u.last_sign_in_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
LEFT JOIN public.organizations o ON o.id = p.organization_id
WHERE (auth.uid() IS NULL)
   OR EXISTS (SELECT 1 FROM public.dashboard_profiles dp WHERE dp.id = auth.uid());

-- REVOKE après CREATE OR REPLACE (le DDL recrée les default grants)
REVOKE ALL ON public.v_dashboard_users FROM anon;
