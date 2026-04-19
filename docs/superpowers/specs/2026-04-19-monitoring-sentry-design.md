# Spec — Module Monitoring Sentry

**Date :** 2026-04-19
**Approche retenue :** A — Edge Function directe, cache 5 min côté hook React
**Route :** `/monitoring`

---

## 1. Architecture

### Flux de données

```
MonitoringPage
  └── useSentry (cache 5 min en mémoire)
        └── supabase.functions.invoke('get-sentry')
              └── Sentry REST API
                    └── (si bug critique) → create-notification Edge Function
```

### Secrets Supabase requis (déjà settés)

| Secret | Valeur |
|--------|--------|
| `SENTRY_AUTH_TOKEN` | Personal API token Sentry |
| `SENTRY_ORG` | `memovia-ai` |
| `SENTRY_PROJECT` | `javascript-react` |

---

## 2. Edge Function : `get-sentry`

**Fichier :** `supabase/functions/get-sentry/index.ts`

**Authentification :** `validateAuth` depuis `_shared/auth.ts` — 401 si JWT invalide.

**Endpoint Sentry appelé :**
```
GET https://sentry.io/api/0/projects/{SENTRY_ORG}/{SENTRY_PROJECT}/issues/
  ?query=is:unresolved
  &statsPeriod=7d
  &limit=50
```
Header : `Authorization: Bearer {SENTRY_AUTH_TOKEN}`

**Réponse retournée :**
```ts
{
  stats: {
    totalIssues: number        // longueur du tableau issues
    totalOccurrences: number   // somme de times_seen sur toutes les issues
    usersAffected: number      // somme de users.count sur toutes les issues
  },
  issues: Array<{
    id: string
    title: string
    level: 'fatal' | 'error' | 'warning' | 'info'
    occurrences: number        // issue.times_seen
    usersAffected: number      // issue.users.count
    firstSeen: string          // ISO date
    lastSeen: string           // ISO date
    permalink: string          // issue.permalink (URL Sentry directe)
    isCritical: boolean        // (level === 'error' || level === 'fatal') && occurrences > 5
  }>,
  fetchedAt: string            // new Date().toISOString()
}
```

**Détection critique & notification :**
- Après mappage des issues, filtrer `isCritical === true`
- Pour chaque issue critique, appeler `${SUPABASE_URL}/functions/v1/create-notification` avec :
  ```json
  {
    "user_id": "<user.id depuis JWT>",
    "type": "sentry_critical",
    "title": "Bug critique détecté",
    "message": "<issue.title> — <occurrences> occurrences"
  }
  ```
- L'appel est fire-and-forget (pas d'await bloquant sur la réponse)
- Header : `Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}`

**Gestion d'erreurs :**
- Sentry API non configurée (token manquant) → `errorResponse('sentry_not_configured', 500)`
- Sentry API HTTP error → `errorResponse('sentry_api_error: <status>', 502)`

---

## 3. Migration SQL

Ajouter `'sentry_critical'` à l'enum `notification_type` dans la table `dashboard_notifications`.

```sql
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'sentry_critical';
```

**Fichier migration :** `supabase/migrations/<timestamp>_add_sentry_notification_type.sql`

---

## 4. Hook React : `useSentry`

**Fichier :** `src/hooks/useSentry.ts`

- Pattern identique à `useGithub` : cache en mémoire avec TTL 5 minutes
- Retourne `{ data, loading, error, refresh }`
- `refresh()` invalide le cache et re-fetche
- Utilise `supabase.functions.invoke('get-sentry')`

**Types TypeScript :**
```ts
interface SentryIssue {
  id: string
  title: string
  level: 'fatal' | 'error' | 'warning' | 'info'
  occurrences: number
  usersAffected: number
  firstSeen: string
  lastSeen: string
  permalink: string
  isCritical: boolean
}

interface SentryData {
  stats: {
    totalIssues: number
    totalOccurrences: number
    usersAffected: number
  }
  issues: SentryIssue[]
  fetchedAt: string
}
```

---

## 5. Page : `MonitoringPage`

**Fichier :** `src/modules/monitoring/MonitoringPage.tsx`

### 5.1 Header
- Titre "Monitoring Sentry" avec icône `Bug` (Lucide)
- Bouton "Rafraîchir" avec icône `RefreshCw` — appelle `refresh()` du hook, spinner pendant loading

### 5.2 KPI Cards (3 colonnes)

| Card | Valeur | Couleur accent |
|------|--------|----------------|
| Bugs actifs | `stats.totalIssues` | `#EF4444` (rouge) |
| Occurrences 7j | `stats.totalOccurrences` | `#F97316` (orange) |
| Utilisateurs affectés | `stats.usersAffected` | `var(--memovia-violet)` |

Pattern visuel : identique aux StatCards de `GitHubPage` (icône dans rond coloré + valeur bold + label).

### 5.3 Liste des issues

Card avec header "Issues non résolues" + badge compteur.

Triées par `lastSeen` décroissant (les plus récentes en premier).

**Chaque ligne :**
- Badge niveau : `fatal` → rouge foncé, `error` → rouge, `warning` → orange, `info` → bleu
- Titre tronqué (1 ligne, `title` attribut HTML pour tooltip natif)
- Icône `RefreshCw` + nombre d'occurrences
- Icône `Users` + nombre d'utilisateurs affectés
- `firstSeen` et `lastSeen` en date relative ("il y a 2h", "il y a 3j") via `formatDistanceToNow` de `date-fns`
- Bouton/lien "Voir sur Sentry" avec icône `ExternalLink`, `target="_blank" rel="noopener noreferrer"`

### 5.4 États

- **Loading :** skeleton 3 KPI + 8 lignes liste (pattern GitHub)
- **Error :** message centré + bouton "Réessayer"
- **Empty :** message "Aucune issue non résolue — tout est clean" avec icône `CheckCircle2` verte

---

## 6. Composants

```
src/modules/monitoring/
├── MonitoringPage.tsx          ← page principale, orchestration
└── components/
    ├── MonitoringKPIs.tsx      ← 3 stat cards
    └── IssueList.tsx           ← liste des issues avec skeleton/empty/error
```

---

## 7. Navigation

**Fichier :** `src/config/navigation.ts`

- Groupe : `platform` (Plateforme)
- Position : après `realtime`, avant `roadmap`
- `id: 'monitoring'`, `label: 'Monitoring'`, `path: '/monitoring'`, `icon: Bug`
- `allowedRoles: []` (visible par tous les admins)

**Fichier :** `src/router/index.tsx`

- Import lazy : `MonitoringPage`
- Route : `path: 'monitoring'`

---

## 8. Déploiement

1. Créer la migration SQL
2. `npx supabase db push` (ou via MCP Supabase)
3. Créer `supabase/functions/get-sentry/index.ts`
4. `npx supabase functions deploy get-sentry --project-ref mzjzwffpqubpruyaaxew`

---

## 9. Hors périmètre

- Historique des issues en base (Approche B écartée)
- Filtres / recherche dans la liste
- Pagination (limite 50 issues, suffisant pour MEMOVIA)
- Graphiques de tendance
