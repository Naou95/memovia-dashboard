# TODOS — MEMOVIA Dashboard

Deferred work captured by `/plan-eng-review` and other skills. Each entry stays here until built, dropped, or superseded. Never delete without a reason in the commit message.

---

## Auth

### [TODO-A1] Password reset flow

**What:** Self-service password reset via `supabase.auth.resetPasswordForEmail()` + a `/reset-password` page (request + confirm).

**Why:** Today, if Emir forgets his password, Naoufel has to log into Supabase dashboard and manually trigger a reset. Low-frequency pain, but 3am-style when it hits.

**Pros:**
- Emir unblocks himself without pinging Naoufel.
- Standard Supabase flow, very well documented.
- Estimated ~30 min CC to implement end-to-end.

**Cons:**
- Adds 2 routes (`/reset-password/request` + `/reset-password/confirm`) and an email template.
- YAGNI for 2-user dashboard in the first months.

**Context:** Intentionally deferred in Module 1 (Auth + Layout). The current design relies on the admin resetting passwords manually via Supabase dashboard. The design doc (`~/.gstack/projects/memovia-dashboard/naoufelbassou-main-design-20260415-162053.md`) lists this under "NOT in scope."

**Depends on / blocked by:** None. Can be added in any later module.

**Source:** /plan-eng-review on 2026-04-15, Module 1.

---

### [TODO-A2] Admin user management UI

**What:** A page at `/admin/users` (admin_full only) listing `dashboard_profiles` rows with INSERT / UPDATE / DELETE capabilities, backed by a Supabase Edge Function that uses `service_role` to bypass RLS for writes.

**Why:** Every new admin requires Naoufel to run raw SQL. When Emir joins, when we add a third admin, when someone leaves. Onboarding friction at exactly the wrong moment.

**Pros:**
- Onboarding drops from minutes-with-SQL to seconds-with-a-form.
- No tribal knowledge about which tables and fields to update.
- Consolidates admin creation into a discoverable, auditable UI.

**Cons:**
- Needs a new Edge Function (`admin-create-profile`) holding `service_role` key. New blast radius.
- Must enforce admin_full role at the Edge Function boundary (not just RLS, since service_role bypasses RLS).
- ~1 hour CC to build responsibly (validation, audit log entry, confirmation modal for deletes).

**Context:** Module 1 deliberately keeps `dashboard_profiles` INSERT blocked by RLS. The design assumes admins are created via SQL migrations or Supabase dashboard. This TODO lives naturally alongside Module 9 (Utilisateurs MEMOVIA) and may share UI primitives with it.

**Depends on / blocked by:** Module 9 (Utilisateurs MEMOVIA) lands the user-list table pattern first; this TODO should probably ride on that work.

**Source:** /plan-eng-review on 2026-04-15, Module 1.

---

## Stripe & Finance

### [TODO-S1] Migration vers React Query

**What:** Remplacer le cache module-level Map dans `useStripeFinance` (et potentiellement `useOverviewKpis`) par React Query (`@tanstack/react-query`).

**Why:** Le cache manuel (module-level Map, TTL 5min) fonctionne pour 2-3 modules mais devient douloureux à maintenir quand chaque module a son propre cache ad-hoc. React Query centralise le cache, gère l'invalidation, les retry, le stale-while-revalidate, et le devtools.

**Pros:**
- Cache centralisé, invalidation cross-modules.
- Retry automatique + exponential backoff.
- DevTools React Query pour debugger les fetches.
- Pattern cohérent sur tous les modules futurs.

**Cons:**
- Nouvelle dépendance (~50KB). Sur-engineered pour un outil interne à 2 users en V1.
- Nécessite de wrapper l'app dans `<QueryClientProvider>` et de migrer tous les hooks existants.

**Context:** Identifié lors du /plan-eng-review Module 3 (2026-04-16). Pattern de cache simple (module-level Map) couvre Module 3 + 4. À reconsidérer à partir du Module 6 (CRM) quand les hooks prolifèrent.

**Depends on / blocked by:** Aucun. Timing optimal : avant ou pendant Module 6.

**Source:** /plan-eng-review on 2026-04-16, Module 3.

---

## Calendrier

### [TODO-C1] Configurer OAuth Google Calendar + Microsoft Outlook

**What:** Avant que le Module 8 (Calendrier) soit fonctionnel, configurer les credentials OAuth des deux providers et les secrets Supabase.

**Étapes Google Calendar :**
1. Aller sur Google Cloud Console → créer un projet (ou utiliser un projet existant MEMOVIA)
2. Activer l'API **Google Calendar API** dans "APIs & Services"
3. Créer des credentials : **OAuth 2.0 Client ID** (type : Web application)
4. Ajouter l'URL de callback autorisée : `https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/calendar-oauth-callback`
5. Récupérer `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`
6. Scope requis : `https://www.googleapis.com/auth/calendar.events`

**Étapes Microsoft Outlook :**
1. Aller sur Azure Portal → Azure Active Directory → App registrations → New registration
2. Choisir "Accounts in any organizational directory and personal Microsoft accounts" (pour couvrir le compte pro d'Emir)
3. Ajouter l'URI de redirection : `https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/calendar-oauth-callback`
4. Dans "Certificates & secrets" → New client secret → récupérer `MICROSOFT_CLIENT_SECRET`
5. Récupérer `MICROSOFT_CLIENT_ID` (= Application (client) ID dans l'aperçu de l'app)
6. Scope requis : `Calendars.Read offline_access`
7. **Note :** Si l'employeur d'Emir a bloqué les autorisations OAuth tierces, la connexion Outlook sera impossible — le module fonctionne quand même avec seulement Google Calendar.

**Variables à ajouter dans Supabase Edge Functions secrets :**
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
APP_URL   (URL du dashboard déployé, ex: https://dashboard.memovia.io)
```
Supabase Dashboard → Project Settings → Edge Functions → Secrets → Add secret.

**URL de callback OAuth (à enregistrer dans les deux providers) :**
```
https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/calendar-oauth-callback
```

**Why:** Sans ces variables, les Edge Functions retournent `google_not_configured` / `microsoft_not_configured` et les boutons "Connecter" dans l'empty state ne fonctionnent pas.

**Pros:** Une fois configuré, le flow OAuth complet fonctionne depuis l'UI — pas de manipulation SQL manuelle pour les tokens.

**Cons:** Nécessite des droits Google Cloud + Azure (Naoufel les a). Pour Emir, dépend de la politique IT de son employeur.

**Context:** Le code est en place depuis Module 8 (2026-04-16). La table `calendar_tokens` existe (migration 00008). Le dashboard affiche un empty state propre tant que les tokens ne sont pas configurés. Appliquer la migration `00008_calendar_tokens.sql` avant toute tentative de connexion OAuth (`supabase db push` ou via le dashboard Supabase).

**Depends on / blocked by:** Migration `00008_calendar_tokens.sql` appliquée en production.

**Source:** Module 8 implémenté le 2026-04-16.

---

## Overview / KPI

### [TODO-O1] Historique KPI pour sparklines Adminix-style sur toutes les cards

**What:** Nouvelle table `dashboard_kpi_snapshots` (columns : `captured_at`, `mrr`, `active_subscribers`, `qonto_balance`, `canceling_count`) + cron Supabase daily qui appelle les Edge Functions existantes et insère un snapshot. Backfill best-effort via Stripe events (subscription.created / deleted) pour reconstruire active_subscribers et canceling_count sur les 6 derniers mois. Pour qonto_balance : pas de backfill possible (pas d'API historique Qonto), on commence à 0 et on accumule.

**Why:** Lors du redesign Overview Adminix-style (2026-04-18), on a dû limiter les sparklines à la card MRR parce que seul `stripeFinance.revenueByMonth` fournit une série temporelle. Les 3 autres cards (Abonnés actifs, Solde Qonto, Annulations en cours) restent sans courbe. Visuellement asymétrique vs référence Adminix.

**Pros:**
- Cohérence visuelle : sparkline sous chaque chiffre-clé.
- Dérive : on peut aussi afficher variations `+X% vs semaine dernière / mois dernier` calculées depuis la table.
- Base pour d'autres dashboards : évolution MRR vs churn, ratio acquisition/perte, etc.

**Cons:**
- ~2h CC à construire (table + migration + cron + Edge Function de snapshot + backfill script).
- Nouvelle table = nouvelle surface d'échec (cron qui plante, snapshot corrompu, duplicates si cron run 2×).
- Nécessite que Stripe + Qonto soient UP au moment du cron — fallback si fail ?

**Context:** Décision 1B du `/plan-eng-review` du 2026-04-18. Le redesign Overview n'ajoute un sparkline QUE sur la card MRR (données `revenueByMonth` déjà disponibles via `get-stripe-finance`). Quand cette TODO sera déroulée, le composant `KpiCard` est déjà prêt (prop `trend?: number[]` ajoutée par le redesign) — il suffit de brancher `dashboard_kpi_snapshots` dessus. Composant `Sparkline.tsx` réutilisable immédiatement.

**Depends on / blocked by:** Rien. Peut être bâti à tout moment. Timing optimal : après Module 15 (Copilote IA) quand l'app est stabilisée et qu'on veut peaufiner les dashboards.

**Source:** /plan-eng-review on 2026-04-18, Overview redesign.

---
