# MEMOVIA Dashboard — Session du 20 avril 2026

## Résumé exécutif
Session complète couvrant : redesign kanban tâches, intégration Telegram, détection leads par email, module rétention Stripe, Analytics PostHog, monitoring Sentry, SEO blog, et nombreux bugs corrigés suite au feedback d'Emir.

---

## 1. Redesign Kanban Tâches (style Linear/Height)

**Référence visuelle :** screenshot Linear/Height fourni par Naoufel

**Changements appliqués :**
- Suppression KPI cards + barre filtres pills
- Header : titre + "Tout · 3 vues" + boutons Filtrer/Trier/Nouvelle tâche
- Colonnes : fond #F4F4F8, border-radius 10px, dot coloré par statut
- Cards : fond blanc, border 0.5px, padding 16px, titre 14px bold, min-height 120px
- Fix fond gris → cards blanches sur colonnes grises (commit `5b1c338`)

---

## 2. Sidebar

- Suppression entrée "Copilote IA" de la nav (bulle flottante suffit)
- Compactage pour tenir sans scroll sur 900px

---

## 3. UI UX Pro Max Skill

- Skill installée depuis `nextlevelbuilder/ui-ux-pro-max-skill`
- Polish complet sur tous les modules (11 commits)
- Patterns fixes : h2→h1, tables aria, tabular-nums, hover memovia-violet-light/60

---

## 4. TopBar — Œil + Notifications

**Icône œil :**
- PrivacyContext global persisté localStorage
- MRR, ARR, Solde Qonto, Revenus 12 mois → `••••`

**Centre de notifications :**
- Bell avec badge rouge count non-lus
- Dropdown Realtime par type
- Table `dashboard_notifications` avec RLS
- Edge Function `create-notification`

---

## 5. SEO & Blog

- Champ "Thème / angle" avant génération
- Prompt système humanisé (sans tirets)
- Catégorie obligatoire à la publication
- **Fix critique :** Markdown → HTML via `marked` avant stockage Supabase
- Édition et suppression articles publiés
- 5 catégories dans `blog_categories`
- Meta tags dynamiques via react-helmet-async sur memovia.io
- Sitemap dynamique mis à jour pour inclure /blog/:slug
- Indexation Google Search Console demandée

---

## 6. Prospection CRM

- Colonnes "Organisation" + "Contact" dans le tableau
- Badges maturité : froid (gris) / tiède (amber) / chaud (vert)
- Compteur relances en orange si > 0
- Date dernier contact
- Design kanban amélioré

---

## 7. email-lead-detector v2

**Nouvelle logique :**
- Groupement par fil de conversation (domaine B2B ou adresse exacte si Gmail/Yahoo)
- Détection dynamique dossier Sent
- Filtrage newsletters avant Claude
- Prompt maturité conversationnelle : statut + maturité + timeline + relance_count
- Emails envoyés sans réponse détectés (statut "contacté", maturité "froid")
- UPSERT par `contact_email`

**Leads détectés :**
- Teddy Gabriel (école) — En discussion, Tiède
- Toulouse INP-ENSEEIHT — Proposition envoyée, Tiède, 1 relance
- IMT Mines Albi — Contacté, Tiède, 1 relance
- ISAE-SUPAERO — Contacté, Tiède, 1 relance
- CFA Blagnac — Contacté, Tiède, 2 relances

**Nouvelles colonnes DB sur `leads` :**
- contact_role, maturity, relance_count, last_contact_date, timeline

**Fix WORKER_RESOURCE_LIMIT :**
- DAYS_BACK=14, MAX_PER_FOLDER=10, MAX_CONVERSATIONS=10, timeout 45s

---

## 8. Intégration Telegram complète

**Bot :** MEMOVIA Dashboard
- TELEGRAM_BOT_TOKEN dans Supabase Secrets
- TELEGRAM_CHAT_ID_NAOUFEL : 783124904
- TELEGRAM_CHAT_ID_EMIR : 5569692552

**Edge Functions déployées :**
| Fonction | Rôle |
|----------|------|
| `send-telegram` | Helper envoi message avec retry |
| `telegram-daily-briefing` | Briefing 8h Paris (cron 0 6 * * *) |
| `telegram-webhook` | Copilote complet sur Telegram |
| `notify-new-user` | Notif à chaque nouvel inscrit |
| `notify-new-email` | Notif nouveaux emails toutes les 30 min |

**Copilote Telegram — contexte chargé :**
- Finances (MRR, ARR, abonnés, annulations, solde Qonto)
- Tâches actives avec retard
- Leads non fermés avec maturité
- Contrats non résiliés
- Alertes, utilisateurs, inscriptions

**6 actions disponibles :**
- create_task, update_task_status, create_lead, update_lead_status, create_contract, send_email

**3 actions Roadmap :**
- create_feedback_item, update_feedback_status, list_feedback_items

**Crons configurés :**
- telegram-daily-briefing : 0 6 * * *
- notify-new-email : */30 * * * *

**Trigger DB :**
- on_new_user_notify sur profiles → notify-new-user à chaque INSERT

---

## 9. Copilote IA dashboard

- Contexte live enrichi (tous modules)
- Tool use Anthropic natif (Approche A)
- Cartes d'action : TaskCard, LeadCard, ContractCard
- Rendu Markdown via react-markdown + remark-gfm
- Tools Roadmap ajoutés

---

## 10. Overview

**Nouveaux blocs :**
- "Votre journée" : tâches + leads urgents (en_discussion/proposition) + calendrier + emails
- "Activité MEMOVIA 24h" : nouvelles inscriptions + abonnés Stripe
- Briefing IA : cache localStorage par date + bouton régénérer

**Fix technique :**
- Boucle infinie useCalendar corrigée (useRef)
- Timeout 5s sur tous les hooks
- ErrorBoundary autour de "Votre journée"
- Guards sur tous les .filter()/.map()

---

## 11. Stripe — Module rétention

- Section "Annulations en cours" (4 abonnés)
- Badge jours restants (rouge si < 7j)
- Bouton "Envoyer email de rétention" → modale avec email pré-rempli
- Envoi via email-send
- Badge vert "Email envoyé" après confirmation

---

## 12. Feedback Emir Boutaleb

**Bugs corrigés :**
- Emir invisible dans Gestion admins → Fix RLS dashboard_profiles
- Calendrier Emir bloqué → Architecture multi-utilisateurs via user_id (migration 00021)
- Clic card Roadmap → ouvre directement la modale d'édition
- Clic card CRM Kanban → ouvre formulaire d'édition
- Champ "Nom du contact" ajouté dans formulaire lead
- "Votre journée" affiche leads urgents en_discussion/proposition

---

## 13. Analytics PostHog

**Intégration :**
- PostHog installé sur app.memovia.io via Lovable
- PostHog installé sur memovia.io via Lovable
- Module Analytics dans le dashboard avec 2 onglets : app.memovia.io / memovia.io

**Données affichées :**
- Visiteurs uniques 7j, pageviews, sessions
- Inscriptions et générations depuis Supabase (données réelles)
- Top pages et sources de trafic
- Filtrage sources parasites (temp-mail, lovable.dev)

**Edge Functions :**
- get-posthog : données PostHog EU
- get-analytics-supabase : inscriptions + générations depuis Supabase

**Données Supabase 7 derniers jours :**
- 89 générations (pic 27 le 15 avril)
- 1 227 générations au total historique

---

## 14. Monitoring Sentry

**Intégration Sentry :**
- Projet créé sur sentry.io (memovia-ai / javascript-react)
- @sentry/react installé sur app.memovia.io via Lovable
- Identification utilisateur connecté
- Capture erreurs critiques

**Module Monitoring dans le dashboard :**
- Page /monitoring dans la sidebar (groupe PLATEFORME)
- Edge Function get-sentry : appelle API Sentry, 14 derniers jours
- 3 KPI cards : bugs actifs, occurrences, utilisateurs affectés
- Liste issues avec badges niveau (fatal/error/warning/info)
- Bouton "Voir sur Sentry"

**Notifications Sentry → Telegram :**
- Tout nouveau bug (firstSeen < 24h) → notif Telegram à Naoufel + Emir
- Emoji par niveau : fatal 🔴 · error 🟠 · warning 🟡 · info 🔵
- Déduplication via table `sentry_notified_issues`

**Secrets Supabase :**
- SENTRY_AUTH_TOKEN, SENTRY_ORG=memovia-ai, SENTRY_PROJECT=javascript-react

---

## 15. Sécurité

- Fausse alerte GitGuardian résolue (URL Supabase dans migrations pg_cron)
- .gitleaks.toml ajouté avec allowlist
- .gstack/ ajouté au .gitignore
- Token Telegram exposé dans chat → révoqué et régénéré

---

## Tables Supabase créées

```
dashboard_notifications     — notifications in-app Realtime
email_notifications_sent    — déduplication notifs email Telegram
sentry_notified_issues      — déduplication notifs Sentry Telegram
```

## Edge Functions déployées

```
send-telegram
telegram-daily-briefing
telegram-webhook
notify-new-user
notify-new-email
create-notification
get-posthog
get-analytics-supabase
get-sentry
```

## Secrets Supabase ajoutés

```
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID_NAOUFEL    — 783124904
TELEGRAM_CHAT_ID_EMIR       — 5569692552
POSTHOG_API_KEY
POSTHOG_PROJECT_ID          — 162131
SENTRY_AUTH_TOKEN
SENTRY_ORG                  — memovia-ai
SENTRY_PROJECT              — javascript-react
```

## Migrations appliquées

```
00017 — leads_maturity_fields
00018 — dashboard_notifications
00019 — telegram_cron
00020 — email_notifications_sent
00021 — calendar_user_id (multi-utilisateurs)
00022 — add_sentry_notification_type
00023 — sentry_notified_issues
```

---

## TODO restants

- [ ] Contacter les 4 abonnés qui annulent sur Stripe (urgent)
- [ ] CRECE deadline 28 mai 2026 — 5 semaines restantes
- [ ] Envoyer magic link à Emir
- [ ] Tester briefing Telegram demain matin 8h
- [ ] Attendre premières données PostHog et Sentry
- [ ] Score de lead automatique (0-100)
- [ ] Templates emails commerciaux
- [ ] Mode mobile optimisé
- [ ] Page paramètres utilisateur
- [ ] supabase gen types typescript (nettoyer les as any)
- [ ] /polish LeadMaturityBadge couleur amber (CSS vars)
- [ ] Résoudre blocage Outlook IT calendrier Emir
```
