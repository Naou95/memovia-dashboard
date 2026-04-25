# Session du 25 avril 2026 — MRR fix, Email redesign, Calendrier, RLS, Telegram

## Vue d'ensemble

Session orientee corrections critiques (auth, finances, securite Supabase) et
refonte UX de deux modules (Email Hostinger, Calendrier). 9 chantiers livres.

## Livrables

### 1. Fix auth / chargement infini

- Cache du profil dashboard dans `localStorage` pour affichage instantane au reload.
- Retry automatique toutes les 15 s si le fetch profile echoue.
- Timeout de 8 s sur le chargement initial pour eviter le spinner infini.

### 2. Fix MRR / ARR Stripe

- Normalisation des intervalles Stripe : les abonnements trimestriels et annuels
  sont maintenant correctement convertis en mensuel pour le calcul du MRR.
- Inclusion des contrats B2B dans le MRR (`mrr_eur` depuis la table `contracts`,
  ex. CFA = 150 EUR/mois).

### 3. Redesign Email Hostinger

- Layout 3 colonnes style Apple Mail (liste / apercu / lecture).
- Composer en slide-in depuis la droite.
- Scroll independant par colonne (liste et lecture scrollent separement).
- Actions sidebar (repondre, transferer, archiver) fixes en haut, ne scrollent pas.
- Barre de reponse sticky en bas du volet lecture.

### 4. Redesign Calendrier

- Vue Apple-style avec 3 modes (jour / semaine / mois).
- Couleurs par utilisateur (Naoufel / Emir) pour distinguer les evenements.
- Fix doublons d'evenements qui apparaissaient lors du switch de vue.
- Boutons Connect / Disconnect Google Calendar dans les parametres.

### 5. Suivi emails retention

- Nouvelle table `retention_emails` pour tracker les emails de retention envoyes.
- Historique des emails affiches sous chaque abonne dans le module Stripe.

### 6. Fix email retention

- Parsing correct des erreurs SMTP (messages d'echec affiches proprement).
- Selecteur d'expediteur (naoufel@, emir@, contact@, support@memovia.io).

### 7. Fix alertes securite Supabase — RLS

Tables sans RLS corrigees :

| Table                      | Avant      | Apres                          |
|----------------------------|------------|--------------------------------|
| `settings`                 | RLS off    | RLS on + `dashboard_admin_all` |
| `fixed_costs`              | RLS off    | RLS on + `dashboard_admin_all` |
| `schools`                  | RLS off    | RLS on + `dashboard_admin_select` |
| `calendar_oauth_states`    | RLS off    | RLS on + `dashboard_admin_all` |
| `email_notifications_sent` | RLS off    | RLS on + `dashboard_admin_all` |
| `sentry_notified_issues`   | RLS off    | RLS on + `dashboard_admin_all` |
| `pending_telegram_actions` | RLS on, 0 policies | + `dashboard_admin_all` |
| `telegram_rate_limit`      | RLS on, 0 policies | + `dashboard_admin_all` |

Vues sensibles :

- `users_without_profile` : `REVOKE ALL` pour `anon` et `authenticated`.
- `v_dashboard_users` : suppression du bypass `auth.uid() IS NULL` initial
  (qui laissait passer les requetes non authentifiees).

### 8. Fix v_dashboard_users

Probleme : `security_invoker = true` empeche `service_role` d'acceder a
`auth.users` (pas de GRANT direct). Le service_role a un `auth.uid()` non-NULL
via son JWT, donc la condition `auth.uid() IS NULL` ne fonctionnait pas non plus.

Solution finale — `security_invoker = false` (DEFINER) + WHERE a 3 chemins :

```sql
WHERE (
  auth.uid() IS NULL                              -- postgres / migrations
  OR current_setting('role') = 'service_role'     -- Edge Functions via PostgREST
  OR EXISTS (
    SELECT 1 FROM dashboard_profiles dp
    WHERE dp.id = auth.uid()
  )                                               -- dashboard admins authentifies
)
```

### 9. Fix Telegram copilote

- La vue `v_dashboard_users` retourne de nouveau 273 inscrits pour le
  `service_role` utilise par l'Edge Function `telegram-webhook`.
- Le copilote affiche a nouveau : total inscrits, repartition par plan,
  nouveaux inscrits 24 h, nouveaux inscrits 7 j.
- Redeploiement de `telegram-webhook` (v24).

## Migrations Supabase appliquees

1. `security_enable_rls_and_fix_views` — RLS + policies + REVOKE
2. `security_v_dashboard_users_invoker` — tentative security_invoker (revertee)
3. `fix_v_dashboard_users_service_role_access` — ajout auth.uid() IS NULL
4. `fix_v_dashboard_users_service_role_bypass` — ajout current_setting('role')
5. `fix_v_dashboard_users_remove_security_invoker` — security_invoker = false
6. `fix_v_dashboard_users_all_access_paths` — WHERE final a 3 conditions
