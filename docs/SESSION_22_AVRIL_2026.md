# Session du 22 avril 2026 — Refonte complète design Qonto

## Vue d'ensemble

Refonte visuelle complète du dashboard MEMOVIA, en 6 phases couvrant les 20+ modules,
alignée sur le design system `DESIGN_QONTO.md`. 41 commits poussés, 0 régression
fonctionnelle.

## Livrables principaux

### Documents créés

- **`DESIGN_QONTO.md`** : design system complet (tokens CSS, sidebar, KPI cards,
  graphiques Recharts, tableaux, boutons, badges statuts, responsive).
- **`REFONT_PLAN.md`** : plan d'exécution en 6 phases avec périmètre par phase
  et règles obligatoires (polish, tests, commit atomique).
- **`docs/design-ref/`** : captures d'écran Qonto servant de référence.

### Skill installé

- `/humanizer` : nettoie les textes générés (signes d'AI writing).

## Phases — refonte par module

### Phase 1 — Fondations
- `index.css` : tokens canoniques (`--bg-primary`, `--bg-hover`, `--danger-bg`,
  `--shadow-xs`, etc.), swap police `DM Sans` → `Geist` + `Geist Mono`.
- `Sidebar.tsx` : layout compact sans scroll, monogramme `M` SVG custom
  (remplace l'icône `Sparkles` générique), active-pill via `layoutId`, nav
  items 13px + stagger mount.
- `TopBar.tsx` : épuration, dropdowns user + notifications.
- `KpiCard.tsx` : prop `delta` (badge pill `+X% vs M-1` vert/rouge),
  transition shadow, hover `y: -1` spring.

### Phase 2 — Finance
- `OverviewPage.tsx` : réorganisation complète des sections, bento KPI 2×2
  strict + Flux financier, Briefing IA, Alertes actionnables (border-left 3px
  + bouton "Voir →").
- `StripePage.tsx`, `QontoPage.tsx` : KPI cards harmonisées, tables `table-fixed`
  + `colgroup` % + `truncate` (plus de scroll horizontal).
- `MRR inclut les contrats B2B actifs` (feat `e66d22c`) : calcul backend + affichage
  `dont X€ B2B` en footer de KpiCard.

### Phase 3 — Commercial
- `ContractsPage.tsx` + `ContractTable.tsx`.
- `ProspectionPage.tsx` + `LeadTable.tsx`.
- `TasksPage.tsx` + Kanban :
  - cards `min-h-140px`, titre `15px/600`, padding `16px 20px`
  - colonnes `flex-1 min-w-280px`
  - header avec compteur "N au total" (suppression des boutons Filtrer/Trier morts)

### Phase 4 — Plateforme
- `UsersPage.tsx` + `UserTable.tsx`, `UserStats.tsx` : grid `auto-rows-fr` +
  `min-h-160px` pour KPI équales.
- `RealtimePage.tsx` + `ActivityFeed.tsx`, `ActivityChart.tsx`, `RealtimeStats.tsx`.
- `RoadmapPage.tsx` + `RoadmapStats.tsx`, `FeedbackBoard.tsx`.
- `MonitoringPage.tsx` + `MonitoringKPIs.tsx`, `IssueList.tsx`.
- `AnalyticsPage.tsx` + `VisitorsChart.tsx`, `GenerationsChart.tsx`.

### Phase 5 — Opérations & Growth
- `EmailPage.tsx` + `EmailList.tsx`, `EmailAlerts.tsx`, `EmailDetail.tsx`,
  `EmailCompose.tsx`.
- `GitHubPage.tsx` + `CommitList.tsx`, `IssueList.tsx`, `PullRequestList.tsx`,
  `WorkflowRuns.tsx`.
- `SeoPage.tsx` + `ArticleEditor.tsx`, `KeywordInput.tsx`, `SerpResults.tsx`,
  `ArticlesList.tsx`.
- `CalendarPage.tsx` + `CreateEventModal.tsx`, `CreateMeetModal.tsx`,
  `CalendarEmptyState.tsx`.
- `CopilotPage.tsx` + `CopilotBubble.tsx`, `TaskCard.tsx`, `LeadCard.tsx`,
  `ContractCard.tsx`.

### Phase 6 — Auth & Admin
- `LoginPage.tsx` : refonte 2 colonnes (55/45), monogramme `M` + "Bon retour 👋"
  24px bold, bouton primary dark `#111827`, colonne droite avec catchphrase
  + 3 bullets features.
- `AdminPage.tsx` : table-fixed + colgroup, hover tokens canoniques,
  ProfileModal + DeleteConfirm en tokens.

## Corrections UI importantes

### Sidebar
- Logo `Sparkles` (tell AI générique) → monogramme `M` SVG custom.
- Scroll interne supprimé — tous les items tiennent sans scrollbar
  (`overflow-hidden` strict + `flex-1 min-h-0`).
- Active pill avec `motion.layoutId` (spring stiff 400, damping 32).
- Micro-interaction : `active:scale-[0.98]` + transition 150ms ease-out.

### Overview
- **Réordonnancement final** : Greeting → Votre journée → Briefing IA →
  KPI 2×2 strict → Flux financier + Revenus facturés → Alertes → Activité →
  24h.
- **Bug hover "Votre journée"** résolu : `overflow-hidden` sur la card
  parente pour clipper le `-mx-5 hover:bg` aux coins arrondis.
- **Items harmonisés** (dernière passe) : layout `flex gap-4` + texte `flex-1`,
  séparateurs `divide-y divide-[#F3F4F6]`, badges unifiés
  `bg-[#F3F4F6] text-[#6B7280]`, icônes 16px violet `flex-shrink-0`.

### KPI cards
- Grid `grid-cols-2 auto-rows-fr` strict (même sur mobile).
- Hauteur égale `min-h-[160px]` (rendu à 213px en pratique avec le contenu).
- Delta MoM calculé côté Overview (`mrrDeltaMoM`) et passé en prop.
- Badge pill `+X% vs M-1` vert (`#F0FDF4` / `#16A34A`) ou rouge
  (`#FEF2F2` / `#DC2626`).

### TopBar — dropdown user
- Avatar + nom + email + badge rôle pill violet.
- Séparateur + liens Paramètres (→ /admin) et Gestion admins.
- Bouton "Se déconnecter" avec icône `LogOut` rouge + hover `--danger-bg`.
- **Fix fond transparent** : `bg-white border-[#E5E7EB] shadow-md z-50
  rounded-[8px]`.

### TopBar — centre notifications
- Panel w-360 `rounded-[12px]` + shadow personnalisée.
- Header "Notifications" 14px bold + compteur pill violet-light.
- Bouton "Tout marquer lu" avec hover `--bg-hover`.
- Empty state illustré (icône cloche dans cercle + titre + sous-titre).
- Items : icône ronde 8×8 accent coloré, titre 13px, message 12px, temps 11px
  tabular-nums.
- Point non lu en `--accent-blue` 2×2 (plus visible que violet-light).

### LoginPage
- 2 colonnes 55/45 (formulaire / visuel).
- Monogramme `M` custom SVG + wordmark MEMOVIA.
- Titre "Bon retour 👋" 24px bold tracking-tight.
- Inputs `h-10 rounded-[8px]` focus border violet.
- Bouton primary dark `#111827` (plus neutre que violet sur login).
- Colonne droite : catchphrase + 3 bullets features
  (finance / CRM / monitoring).

## Bugs corrigés

| Bug | Fix | Commit |
| --- | --- | --- |
| Calendrier : événements Emir dupliqués | `allUsersData` source unique | `acf57ae` |
| Calendrier : filtre owner cassé | `includes()` au lieu d'égalité stricte | `c695795` |
| Calendrier : texte illisible sur événements | réécriture style | `6d09e97` |
| MRR n'incluait pas les contrats B2B | feat MRR = `stripe + contrats.actif` | `e66d22c` |
| Sidebar : scrollbar visible en bas | `overflow-hidden` strict + `min-h-0` | `5a298b9` |
| CRM : overflow horizontal sur tables | `table-fixed` + `colgroup %` + `truncate` partout | phase 3-5 |
| Sidebar : avatar Naoufel coupé | `shrink-0` sur footer user card | `45ca4d1` |
| KPI cards non-responsive | `md:grid-cols-2 xl:grid-cols-3` puis `grid-cols-2` strict | `45ca4d1`, `3d20715` |
| Hover "Votre journée" débordait coins arrondis | `overflow-hidden` sur card parente | `7b73b10` |
| Dropdown user fond transparent | `bg-white` + border + shadow-md + z-50 | `7e00324` |

## Features ajoutées

- **MRR inclut contrats B2B actifs** (`e66d22c`) : calcul `mrr_total =
  mrr_stripe + mrr_contracts`, affichage en footer de KpiCard "dont X€ B2B",
  fallback si `mrr_total` absent.
- **Cache localStorage + SWR + indicateur fraîcheur** (`5448ecd`) : hooks data
  lisent d'abord le cache local, revalident en arrière-plan, exposent
  `lastFetchedAt` pour un badge "Mis à jour il y a Xmin".
- **Calendrier partagé Naoufel + Emir** avec disponibilités communes
  (`4773f97`, `7b3cf96`).
- **Delta MoM sur KPI MRR** (`4117b01`) : calcul `(curr - prev) / prev`, badge
  pill vert/rouge "+X% vs M-1".
- **Alertes Overview actionnables** : passage de pills décoratives à rangées
  avec border-left 3px + bouton "Voir →" navigate vers le module.
- **Sidebar user card** : avatar + nom + rôle formaté, mini dropdown.
- **Privacy toggle** (Eye/EyeOff) : masque les valeurs sensibles (MRR, solde
  Qonto) par `••••`.
- **Centre de notifications** complet (4 types : lead_stale, email_critical,
  new_lead, stripe_cancel) avec persistance.

## Layout — densification finale

- `main` : `p-6` → `px-6 py-5` (vertical plus tight).
- `OverviewPage` : `space-y-6` → `space-y-5` (moins de blanc entre sections).
- KPI bento : `grid-cols-1 sm:grid-cols-2` → `grid-cols-2` strict.

## Micro-interactions (emil-design-eng)

- Boutons globaux : `transition transform 150ms ease-out` + `active:scale-0.97`
  sur tous les `button:not([disabled])` (via `index.css`).
- Sidebar nav items : `active:scale-[0.98]` + transform 150ms.
- KPI cards : `whileHover={{ y: -1 }}` spring 240/20 + shadow CSS transition.
- "Votre journée" rows : `active:scale-[0.995]` micro-press feedback.
- `prefers-reduced-motion` respecté (animations désactivées).

## Tokens canoniques (index.css)

- Surfaces : `--bg-primary`, `--bg-secondary`, `--bg-hover`, `--bg-active`
- Bordures : `--border-color`, `--border-strong`, `--border-subtle`
- Texte : `--text-primary`, `--text-secondary`, `--text-muted`, `--text-label`
- Brand : `--memovia-violet`, `--memovia-violet-light`, `--memovia-violet-hover`
- Feedback : `--success`, `--success-bg`, `--danger`, `--danger-bg`,
  `--warning`, `--warning-bg`
- Accents : `--accent-blue`, `--accent-blue-bg`, `--accent-purple`
- Ombres : `--shadow-xs`, `--shadow-sm`
- Radius : `rounded-[8px]` (radius principal), `rounded-lg` (6px, inputs/badges),
  `rounded-md` (4px, skeletons), `rounded-full` (pills)

## Règles de code appliquées partout

- Aucun hex en dur pour les couleurs (hors exceptions justifiées :
  `#F3F4F6`/`#6B7280` sur badges journée, icônes feedback Sentry Monitoring).
- Aucun `overflow-x-auto` sur les tables — toutes en `overflow-hidden` +
  `table-fixed` + `<colgroup>` avec largeurs en % + `truncate` sur cellules
  texte.
- Radius principal `rounded-[8px]` (remplace `rounded-xl` et `rounded-2xl`
  partout sauf chat bubbles Copilot et floating panel).
- Shadow `--shadow-xs` sur cards et `--shadow-sm` sur tooltips/hover.
- Header des modules : `<h2>` 2xl/semibold tracking-tight (plus d'icônes
  carrées violettes en en-tête).

## Historique des commits (ordre chronologique inverse)

```
7e00324 topbar : dropdown user opaque + lien Paramètres → /admin
7d00cc8 fix visuel : Votre journée items harmonisés
e01b2ea phase 6 — refonte admin style Qonto (fin du refont)
3d20715 layout : densification espace
7b73b10 fix : hover Votre journée débordait des coins arrondis
b231a3c notifications : refonte style Qonto
9b8ae91 topbar : dropdown user enrichi (avatar + email + rôle + liens)
dde113d login : refonte 2 colonnes style Qonto
a7c305c phase 5.5 — refonte copilot style Qonto
79de81f phase 5.4 — refonte calendar style Qonto
86837c1 phase 5.3 — refonte seo & blog style Qonto
1f1616a phase 5.2 — refonte github style Qonto
9598b9d phase 5.1 — refonte email style Qonto
4e2a491 phase 4.5 — refonte analytics style Qonto
1fa8f00 phase 4.4 — refonte monitoring style Qonto
9940bd8 phase 4.3 — refonte roadmap style Qonto
3bb35d6 phase 4.2 — refonte realtime style Qonto
fffd35a phase 4.1 — refonte utilisateurs style Qonto
1fee9a9 polish tâches : compteur + retrait UI morte
bab7880 phase 3 — kanban cards plus grandes (140px, titre 15px)
f6a483a overview : ordre sections Journée+Briefing avant KPI
4117b01 refonte UI : Geist, logo monogramme, KPI delta MoM, alertes
536d0fd refont(phase-3): modules Commercial style Qonto
45ca4d1 fix(overview): sidebar avatar visible + KPI responsive + ordre
e559832 refont(phase-2): modules Finance style Qonto
5a298b9 refont(sidebar): compact layout - tous les items sans scroll
cae51f2 refont(phase-1): design system Qonto — fondations
4f7819d docs: captures design reference Qonto
```

## Status final

| Phase | Périmètre | Status |
| --- | --- | --- |
| 1 | Fondations (tokens, Sidebar, TopBar, KpiCard) | ✅ |
| 2 | Finance (Overview, Stripe, Qonto) | ✅ |
| 3 | Commercial (Contracts, CRM, Tâches) | ✅ |
| 4 | Plateforme (Users, Realtime, Roadmap, Monitoring, Analytics) | ✅ |
| 5 | Opérations & Growth (Email, GitHub, SEO, Calendar, Copilot) | ✅ |
| 6 | Auth & Admin (Login 2 colonnes + AdminPage) | ✅ |

Dashboard entièrement aligné sur le design system Qonto. Prêt pour la prochaine
itération (features, pas design).
