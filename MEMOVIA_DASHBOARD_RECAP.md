# MEMOVIA Dashboard — Récapitulatif des sessions

## Session du 19 avril 2026

### MODULES ET FEATURES AJOUTÉS

- **Redesign kanban Tâches** (style Linear/Height) — cards plus grandes, colonnes `#F4F4F8`
- **Sidebar** : suppression Copilote IA de la nav, compactage pour tenir sans scroll
- **UI UX Pro Max skill** installée et appliquée sur tous les modules (11 commits polish)
- **Icône œil TopBar** — masquage confidentialité des chiffres sensibles (`PrivacyContext`)
- **Centre de notifications TopBar** — Bell avec badge, dropdown Realtime, table `dashboard_notifications`
- **SEO** : champ thème/angle article, prompt système humanisé, sélection catégorie obligatoire, édition/suppression articles, conversion Markdown → HTML avant stockage
- **CRM** : colonnes Organisation + Contact, badges maturité (froid/tiède/chaud), relances, dernier contact
- **email-lead-detector v2** : analyse maturité conversationnelle, groupement par fil, INBOX + Sent, UPSERT par `contact_email`
- **Colonnes DB ajoutées sur `leads`** : `contact_role`, `maturity`, `relance_count`, `last_contact_date`, `timeline`
- **Intégration Telegram complète** :
  - Bot MEMOVIA Dashboard (`@memovia_dashboard_bot`)
  - Edge Function `send-telegram`
  - `telegram-daily-briefing` (cron 8h Paris)
  - `telegram-webhook` : copilote complet avec contexte live (finances, tâches, leads, contrats, utilisateurs) + 6 actions (`create_task`, `update_task_status`, `create_lead`, `update_lead_status`, `create_contract`, `send_email`)
  - `notify-new-user` : notif Telegram à chaque nouvel inscrit (trigger DB)
  - `notify-new-email` : notif Telegram nouveaux emails toutes les 30 min (hors newsletters)
- **Copilote IA** : tool use Anthropic natif, 3 cartes d'action (`TaskCard`, `LeadCard`, `ContractCard`), contexte enrichi au démarrage, tools Roadmap (`create_feedback_item`, `update_feedback_status`, `list_feedback_items`)
- **Overview** : bloc "Votre journée" (tâches + leads + calendrier + emails), bloc "Activité MEMOVIA 24h", briefing IA avec cache par jour + bouton régénérer
- **Stripe** : section "Annulations en cours" avec email de rétention en 1 clic
- **Utilisateurs/Realtime** : filtres semaine/mois
- **Détection leads emails** : emails envoyés sans réponse maintenant détectés (statut "contacté")
- **Sécurité** : fausse alerte GitGuardian résolue, `.gitleaks.toml` ajouté

### EDGE FUNCTIONS AJOUTÉES

| Fonction | Rôle |
|---|---|
| `send-telegram` | Envoi de messages au bot Telegram |
| `telegram-daily-briefing` | Briefing quotidien automatique (cron 8h UTC) |
| `telegram-webhook` | Copilote Telegram avec contexte live + 6 actions |
| `notify-new-user` | Notification à chaque nouvel inscrit (trigger DB) |
| `notify-new-email` | Notification nouveaux emails toutes les 30 min |
| `create-notification` | Création de notifications dashboard |

### TABLES SUPABASE AJOUTÉES

| Table | Rôle |
|---|---|
| `dashboard_notifications` | Centre de notifications TopBar (Realtime) |
| `email_notifications_sent` | Déduplication des notifications email Telegram |

### SECRETS SUPABASE AJOUTÉS

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID_NAOUFEL`
- `TELEGRAM_CHAT_ID_EMIR`

### TRIGGERS DB

| Trigger | Table | Action |
|---|---|---|
| `on_new_user_notify` | `profiles` | Appel Edge Function `notify-new-user` |

### CRONS AJOUTÉS

| Cron | Fréquence | Rôle |
|---|---|---|
| `telegram-daily-briefing` | Tous les jours à 8h UTC | Briefing quotidien Telegram |
| `email-lead-detector` | Toutes les heures | Détection leads depuis emails |
| `notify-new-email` | Toutes les 30 min | Notification nouveaux emails Telegram |
