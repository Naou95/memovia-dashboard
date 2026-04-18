-- Vue lecture seule pour le dashboard MEMOVIA — Module 9 Utilisateurs
-- Joint profiles + auth.users (email, last_sign_in_at) + organizations (nom)
-- N'expose aucune donnée sensible (pas de hash, pas de tokens).

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
LEFT JOIN public.organizations o ON o.id = p.organization_id;

-- Accès lecture aux rôles authentifiés du dashboard
GRANT SELECT ON public.v_dashboard_users TO anon, authenticated;
