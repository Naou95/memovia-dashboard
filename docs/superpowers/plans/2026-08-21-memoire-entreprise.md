# Mémoire d'entreprise — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au dashboard la mémoire d'entreprise validée dans la spec `docs/superpowers/specs/2026-08-21-memoire-entreprise-design.md` : partenaires, historique produit, engagements liés aux fiches, historique concours.

**Architecture:** Tout se greffe sur la v2 existante — les partenaires vivent dans `leads` (onglet), l'historique produit dans une table `product_milestones` alimentée par un cron GitHub hebdo + tri humain en un clic, les engagements dans `tasks.lead_id`. Une seule nouvelle page (`/historique`).

**Tech Stack:** React + TS + Vite, vitest, Supabase (Postgres + edge functions Deno), pg_cron + pg_net, GitHub REST API.

## Global Constraints

- Branche `feat/memoire-entreprise` depuis `main` à jour ; JAMAIS de push main ; confirmation Naoufel avant commit/push/merge (une confirmation peut couvrir la série de commits de la PR).
- Baselines mesurées sur main AVANT le premier edit : `npm run typecheck`, `npm test`, `deno check --node-modules-dir=none supabase/functions/telegram-daily-briefing/index.ts`. Après chaque tâche : mêmes commandes, comparées ligne à ligne — zéro erreur nouvelle.
- Migrations = fichiers dans `supabase/migrations/`, appliquées en prod via MCP `apply_migration` APRÈS merge seulement.
- Deploys edge par Naoufel depuis son terminal (trousseau macOS) ; `npx supabase secrets set` pareil.
- CR de RDV toujours au neutre ; AUCUNE donnée d'historique insérée sans validation Naoufel (backfills = hors PR, passes séparées).
- Commits atomiques en français, `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Dépôts GitHub du changelog : `Naou95/memovia-ia-notes`, `Naou95/memovia-ia-notes-landing-page`, `Naou95/memovia-landing-it`, `Naou95/memovia-dashboard`, `Naou95/memovia-guides`.

---

### Task 1: Migration 00047 — schéma (partenaires, engagements, jalons)

**Files:**
- Create: `supabase/migrations/00047_memoire_entreprise.sql`

**Interfaces:**
- Produces: valeur `'partenaire'` dans `leads.type`, `'actif'` dans `leads.status` ; colonne `tasks.lead_id uuid null → leads(id)` ; table `public.product_milestones(id, date, repo, title, detail, source_url unique, status candidat|retenu|ecarte, created_by, created_at)`.

- [ ] **Step 1: Écrire la migration**

```sql
-- Migration 00047 : mémoire d'entreprise (spec docs/superpowers/specs/2026-08-21-memoire-entreprise-design.md).
-- 1) Partenaires dans `leads` : type 'partenaire' + status 'actif' (le cycle nouveau→perdu
--    n'a pas de sens pour Christelle/Compagnons, Paidea, TBS).
-- 2) Engagements : une tâche peut être liée à une fiche (tasks.lead_id).
-- 3) Historique produit : table product_milestones, alimentée par le cron changelog-collect
--    (candidats) + tri humain (retenu/écarté). source_url UNIQUE = clé de dédupe du cron.

ALTER TABLE public.leads DROP CONSTRAINT leads_type_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_type_check
  CHECK (type IN ('ecole', 'cfa', 'entreprise', 'autre', 'partenaire'));

ALTER TABLE public.leads DROP CONSTRAINT leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('nouveau', 'contacte', 'en_discussion', 'proposition', 'gagne', 'perdu', 'actif'));

ALTER TABLE public.tasks ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;
CREATE INDEX tasks_lead_id_idx ON public.tasks(lead_id) WHERE lead_id IS NOT NULL;

CREATE TABLE public.product_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  repo text NOT NULL,
  title text NOT NULL,
  detail text,
  source_url text UNIQUE,
  status text NOT NULL DEFAULT 'candidat' CHECK (status IN ('candidat', 'retenu', 'ecarte')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_milestones ENABLE ROW LEVEL SECURITY;

-- Une seule policy admin (les policies permissives s'additionnent : ne pas élargir) —
-- même pattern que financements (00045).
CREATE POLICY product_milestones_admin_all ON public.product_milestones
  FOR ALL TO authenticated
  USING (public.is_dashboard_admin(auth.uid()))
  WITH CHECK (public.is_dashboard_admin(auth.uid()));

REVOKE ALL ON public.product_milestones FROM anon;
```

- [ ] **Step 2: Vérifier la syntaxe à froid** — relire les noms de contraintes contre la prod (`leads_type_check`, `leads_status_check` confirmés le 21/08 via `pg_constraint`). Pas d'application maintenant (post-merge).

- [ ] **Step 3: Commit** — `git add supabase/migrations/00047_memoire_entreprise.sql && git commit -m "feat(schema): partenaires, tasks.lead_id, product_milestones (00047)"`

---

### Task 2: Onglet Partenaires dans la section Leads

**Files:**
- Modify: `src/types/leads.ts` (types + helper)
- Test: `src/test/LeadTabs.test.ts`
- Modify: `src/modules/prospection/ProspectionPage.tsx`
- Modify: `src/modules/prospection/components/LeadForm.tsx`

**Interfaces:**
- Consomme : valeurs `'partenaire'`/`'actif'` (Task 1).
- Produit : `type LeadTab = 'cfa' | 'partenaires'` et `filterLeadsByTab(leads: Lead[], tab: LeadTab): Lead[]` exportés de `src/types/leads.ts` ; prop `partnerMode?: boolean` sur `LeadForm`.

- [ ] **Step 1: Types + helper + test qui échoue**

Dans `src/types/leads.ts` : `LeadType` += `'partenaire'`, `LeadStatus` += `'actif'`, `LEAD_STATUS_LABELS` += `actif: 'Actif'` (NE PAS ajouter `'actif'` à `LEAD_STATUS_ORDER` : il pilote le kanban de prospection). Ajouter :

```ts
export type LeadTab = 'cfa' | 'partenaires'

// L'onglet Prospection CFA garde STRICTEMENT le comportement d'avant l'arrivée des
// partenaires : tout ce qui n'est pas type='partenaire' y reste visible.
export function filterLeadsByTab(leads: Lead[], tab: LeadTab): Lead[] {
  return leads.filter((l) =>
    tab === 'partenaires' ? l.type === 'partenaire' : l.type !== 'partenaire',
  )
}
```

Test `src/test/LeadTabs.test.ts` (suivre le style de `src/test/LeadScoring.test.ts`) :

```ts
import { describe, it, expect } from 'vitest'
import { filterLeadsByTab } from '@/types/leads'
import type { Lead } from '@/types/leads'

const lead = (over: Partial<Lead>): Lead => ({
  id: 'x', name: 'X', type: 'cfa', canal: 'email', status: 'nouveau',
  next_action: null, follow_up_date: null, assigned_to: null, notes: null,
  created_at: '', updated_at: '', created_by: null, contact_email: null,
  contact_name: null, contact_role: null, source: null, maturity: null,
  relance_count: 0, last_contact_date: null, timeline: null,
  contact_phone: null, archived: false, ...over,
})

describe('filterLeadsByTab', () => {
  const leads = [lead({ id: 'a', type: 'cfa' }), lead({ id: 'b', type: 'partenaire', status: 'actif' }), lead({ id: 'c', type: 'autre' })]
  it('cfa exclut les partenaires, garde tout le reste', () => {
    expect(filterLeadsByTab(leads, 'cfa').map((l) => l.id)).toEqual(['a', 'c'])
  })
  it('partenaires ne garde que les partenaires', () => {
    expect(filterLeadsByTab(leads, 'partenaires').map((l) => l.id)).toEqual(['b'])
  })
})
```

- [ ] **Step 2: `npm test` → le nouveau test échoue** (helper absent), puis implémenter, puis `npm test` → vert.

- [ ] **Step 3: Onglets dans `ProspectionPage.tsx`** — state `const [tab, setTab] = useState<LeadTab>('cfa')` ; appliquer `filterLeadsByTab(leads, tab)` EN AMONT du filtre `archived` existant (`ProspectionPage.tsx:45`) ; deux boutons d'onglet au-dessus des stats (style des toggles table/kanban existants, `ProspectionPage.tsx` en tête de rendu) : « Prospection CFA » / « Partenaires ». Sous l'onglet Partenaires : masquer `LeadStats`, le kanban et les filtres de statut/maturité (sans objet), garder table + mobile + bouton « Nouveau partenaire » qui ouvre `LeadForm` en `partnerMode`.

- [ ] **Step 4: `LeadForm.tsx` mode partenaire** — prop `partnerMode?: boolean`. Quand `true` : `type` forcé `'partenaire'` (champ masqué), `status` forcé `'actif'` (masqué), masquer maturité/relance/follow-up pipeline ; garder nom, contact (nom/email/tél/rôle), canal, assigné, notes, next_action. Ne rien changer au mode existant.

- [ ] **Step 5: `npm run typecheck` + `npm test` vs baselines, vue mobile vérifiée (règle v2), commit** — `git commit -m "feat(leads): onglet Partenaires (type partenaire, status actif)"`

---

### Task 3: Page /historique (jalons produit)

**Files:**
- Create: `src/types/milestones.ts`
- Create: `src/hooks/useMilestones.ts`
- Create: `src/modules/historique/HistoriquePage.tsx`
- Test: `src/test/Milestones.test.ts`
- Modify: `src/router/index.tsx` (route `historique`, même pattern lazy que `financements` à `src/router/index.tsx:91-98`)
- Modify: `src/config/navigation.ts` (entrée en DERNIÈRE position)

**Interfaces:**
- Consomme : table `product_milestones` (Task 1).
- Produit : `interface Milestone { id: string; date: string; repo: string; title: string; detail: string | null; source_url: string | null; status: 'candidat' | 'retenu' | 'ecarte'; created_at: string }` ; `groupMilestones(items: Milestone[]): { retenus: Milestone[]; candidats: Milestone[] }` (tous deux triés date desc) exportés de `src/types/milestones.ts` ; hook `useMilestones(): { milestones, isLoading, error, setStatus(id, status) }`.

- [ ] **Step 1: Types + helper + test qui échoue**

```ts
// src/types/milestones.ts
export interface Milestone {
  id: string
  date: string
  repo: string
  title: string
  detail: string | null
  source_url: string | null
  status: 'candidat' | 'retenu' | 'ecarte'
  created_at: string
}

export function groupMilestones(items: Milestone[]): { retenus: Milestone[]; candidats: Milestone[] } {
  const byDateDesc = (a: Milestone, b: Milestone) => b.date.localeCompare(a.date)
  return {
    retenus: items.filter((m) => m.status === 'retenu').sort(byDateDesc),
    candidats: items.filter((m) => m.status === 'candidat').sort(byDateDesc),
  }
}
```

Test `src/test/Milestones.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { groupMilestones } from '@/types/milestones'
import type { Milestone } from '@/types/milestones'

const m = (over: Partial<Milestone>): Milestone => ({
  id: 'x', date: '2026-01-01', repo: 'memovia-ia-notes', title: 'T',
  detail: null, source_url: null, status: 'candidat', created_at: '', ...over,
})

describe('groupMilestones', () => {
  it('sépare retenus/candidats, écarte les écartés, trie date desc', () => {
    const items = [
      m({ id: 'a', status: 'retenu', date: '2026-05-01' }),
      m({ id: 'b', status: 'candidat', date: '2026-08-01' }),
      m({ id: 'c', status: 'ecarte' }),
      m({ id: 'd', status: 'retenu', date: '2026-07-01' }),
    ]
    const { retenus, candidats } = groupMilestones(items)
    expect(retenus.map((x) => x.id)).toEqual(['d', 'a'])
    expect(candidats.map((x) => x.id)).toEqual(['b'])
  })
})
```

- [ ] **Step 2: `npm test` → échec, implémenter, → vert.**

- [ ] **Step 3: Hook `useMilestones.ts`** — copier la structure de `src/hooks/useTasks.ts` (fetch all + realtime channel `product_milestones-changes`) ; `setStatus = async (id: string, status: 'retenu' | 'ecarte') => { update + refetch }`.

- [ ] **Step 4: `HistoriquePage.tsx`** — règles v2 (clair, tables denses, horodatage) : bandeau « X candidats à trier » si `candidats.length > 0` avec, par candidat, titre + repo + date + lien PR + boutons **Retenir** / **Écarter** ; en dessous, timeline des retenus groupée par mois (`date` desc), chaque ligne : date · repo · titre · lien PR. Erreur de fetch affichée, jamais silencieuse.

- [ ] **Step 5: Route + nav** — `src/router/index.tsx` : route `historique` sur le modèle exact du bloc `financements` ; `src/config/navigation.ts` : import `History` de lucide-react, append en fin de `NAV_ITEMS` : `{ id: 'historique', label: 'Historique', path: '/historique', icon: History, status: 'active', allowedRoles: [] }`. `section_visits` est loggé par `AppLayout` pour toute route : rien à faire.

- [ ] **Step 6: typecheck + tests vs baselines, commit** — `git commit -m "feat(historique): page jalons produit (timeline + tri candidats)"`

---

### Task 4: Engagements liés aux fiches

**Files:**
- Modify: `src/types/tasks.ts` (`lead_id`)
- Test: `src/test/Engagements.test.ts`
- Create: `src/modules/prospection/components/LeadEngagements.tsx`
- Modify: `src/modules/prospection/components/LeadForm.tsx` (intégration)

**Interfaces:**
- Consomme : `tasks.lead_id` (Task 1), `useTasks()` existant (`src/hooks/useTasks.ts` — `tasks`, `createTask(TaskInsert)`, `updateTask(id, TaskUpdate)`).
- Produit : `splitTasksForLead(tasks: Task[], leadId: string): { ouvertes: Task[]; faites: Task[] }` exporté de `src/types/tasks.ts` ; composant `<LeadEngagements leadId={string} />`.

- [ ] **Step 1: `src/types/tasks.ts`** — ajouter `lead_id: string | null` à `Task` (et aux types Insert/Update s'ils sont des `Omit`/`Partial` dérivés, vérifier dans le fichier), plus le helper + test qui échoue :

```ts
export function splitTasksForLead(tasks: Task[], leadId: string): { ouvertes: Task[]; faites: Task[] } {
  const liees = tasks.filter((t) => t.lead_id === leadId)
  return {
    ouvertes: liees.filter((t) => t.status !== 'done'),
    faites: liees.filter((t) => t.status === 'done'),
  }
}
```

```ts
// src/test/Engagements.test.ts
import { describe, it, expect } from 'vitest'
import { splitTasksForLead } from '@/types/tasks'
import type { Task } from '@/types/tasks'

const t = (over: Partial<Task>): Task => ({
  id: 'x', title: 'T', description: null, status: 'todo', priority: 'normale',
  due_date: null, assigned_to: 'naoufel', created_at: '', updated_at: '',
  created_by: null, is_private: false, assignees: null, lead_id: null, ...over,
} as Task)

describe('splitTasksForLead', () => {
  it('ne prend que les tâches de la fiche, sépare ouvertes/faites', () => {
    const tasks = [
      t({ id: 'a', lead_id: 'L1', status: 'todo' }),
      t({ id: 'b', lead_id: 'L1', status: 'done' }),
      t({ id: 'c', lead_id: 'L2' }),
      t({ id: 'd', lead_id: null }),
    ]
    const { ouvertes, faites } = splitTasksForLead(tasks, 'L1')
    expect(ouvertes.map((x) => x.id)).toEqual(['a'])
    expect(faites.map((x) => x.id)).toEqual(['b'])
  })
})
```

⚠️ Ajuster la factory `t()` aux champs RÉELS de `src/types/tasks.ts` (le fichier fait foi, ne pas inventer de champs).

- [ ] **Step 2: `npm test` → échec, implémenter, → vert.**

- [ ] **Step 3: `LeadEngagements.tsx`** — `useTasks()` + `splitTasksForLead` ; liste ouvertes (titre, assigné, échéance, case « fait » → `updateTask(id, { status: 'done' })`), historique faites replié (`<details>`), ajout rapide : input titre + select assigné + date optionnelle → `createTask({ title, assigned_to, due_date, status: 'todo', priority: 'normale', lead_id })`.

- [ ] **Step 4: Intégrer dans `LeadForm.tsx`** — bloc « Engagements » visible UNIQUEMENT en édition d'une fiche existante (`lead?.id` présent), tous onglets (prospects ET partenaires).

- [ ] **Step 5: typecheck + tests vs baselines, commit** — `git commit -m "feat(fiches): engagements — tâches liées à une fiche lead/partenaire"`

---

### Task 5: Filtre « En cours / Historique » dans Financements

> **CONSTAT D'EXÉCUTION (21/08)** : déjà couvert par la Phase 3 v2 — `FinancementsPage.tsx`
> sépare déjà `open`/`closed` (`CLOSED_STATUSES = gagne/perdu/abandonne`) avec un toggle
> « Afficher les clos (N) », repliés par défaut. Aucun code ajouté ; les concours passés
> backfillés (Task 10) y apparaîtront d'office. Les steps ci-dessous sont conservés pour
> trace mais NON exécutés.

**Files:**
- Modify: `src/types/financements.ts` si présent, sinon le fichier où vit le type `Financement` (le trouver via `grep -rn "interface Financement" src/`)
- Test: `src/test/FinancementsFiltre.test.ts`
- Modify: `src/modules/financements/FinancementsPage.tsx`

**Interfaces:**
- Produit : `splitFinancements(items: Financement[]): { enCours: Financement[]; termines: Financement[] }` — terminés = status `gagne | perdu | abandonne`.

- [ ] **Step 1: Helper + test qui échoue** — ⚠️ ajuster la factory aux champs RÉELS du type `Financement` (le fichier source fait foi) :

```ts
// src/test/FinancementsFiltre.test.ts
import { describe, it, expect } from 'vitest'
import { splitFinancements } from '@/types/financements'
import type { Financement } from '@/types/financements'

const f = (over: Partial<Financement>): Financement => ({
  id: 'x', name: 'X', type: 'concours', status: 'veille', deadline: null,
  next_action: null, assigned_to: null, notes: null, url: null,
  created_by: null, created_at: '', updated_at: '', ...over,
} as Financement)

describe('splitFinancements', () => {
  it('sépare en cours / terminés sans perdre de ligne', () => {
    const items = [
      f({ id: 'a', status: 'jury' }),
      f({ id: 'b', status: 'gagne' }),
      f({ id: 'c', status: 'perdu' }),
      f({ id: 'd', status: 'abandonne' }),
      f({ id: 'e', status: 'veille' }),
    ]
    const { enCours, termines } = splitFinancements(items)
    expect(enCours.map((x) => x.id)).toEqual(['a', 'e'])
    expect(termines.map((x) => x.id)).toEqual(['b', 'c', 'd'])
    expect(enCours.length + termines.length).toBe(items.length)
  })
})
```

```ts
export const FINANCEMENT_STATUTS_TERMINES = ['gagne', 'perdu', 'abandonne'] as const

export function splitFinancements(items: Financement[]): { enCours: Financement[]; termines: Financement[] } {
  const done = new Set<string>(FINANCEMENT_STATUTS_TERMINES)
  return {
    enCours: items.filter((f) => !done.has(f.status)),
    termines: items.filter((f) => done.has(f.status)),
  }
}
```

- [ ] **Step 2: `npm test` → échec, implémenter, → vert.**

- [ ] **Step 3: `FinancementsPage.tsx`** — toggle « En cours (N) / Historique (M) », **En cours par défaut** ; l'historique liste les terminés avec statut et date.

- [ ] **Step 4: typecheck + tests vs baselines, commit** — `git commit -m "feat(financements): filtre En cours / Historique, terminés repliés"`

---

### Task 6: Edge function `changelog-collect` + cron hebdo (00048)

**Files:**
- Create: `supabase/functions/changelog-collect/index.ts`
- Create: `supabase/migrations/00048_changelog_collect_cron.sql`

**Interfaces:**
- Consomme : `product_milestones` (Task 1), secret edge `GITHUB_CHANGELOG_TOKEN` (créé par Naoufel : fine-grained, lecture seule PR/contents sur les 5 dépôts), auth cron partagée (`_shared/cronAuth.ts`).
- Produit : insert de candidats dédupliqués sur `source_url` ; réponse JSON `{ found, inserted }`.

- [ ] **Step 1: Écrire la fonction**

```ts
import { corsHeaders, errorResponse } from '../_shared/auth.ts'
import { isAuthenticatedCronCall } from '../_shared/cronAuth.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Les 5 dépôts MEMOVIA (CLAUDE.md racine ~/memovia).
const REPOS = [
  'Naou95/memovia-ia-notes',
  'Naou95/memovia-ia-notes-landing-page',
  'Naou95/memovia-landing-it',
  'Naou95/memovia-dashboard',
  'Naou95/memovia-guides',
]
// 8 jours et pas 7 : le cron est hebdo, une dérive d'horaire ne doit pas perdre de PR ;
// la dédupe sur source_url absorbe le chevauchement.
const DAYS_BACK = 8

interface SearchItem {
  title: string
  html_url: string
  repository_url: string
  pull_request?: { merged_at?: string | null }
  closed_at: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const isCronCall = serviceRoleKey.length > 0 && authHeader === `Bearer ${serviceRoleKey}`
  if (!isCronCall && !(await isAuthenticatedCronCall(req))) {
    return errorResponse('unauthorized', 401)
  }

  const ghToken = Deno.env.get('GITHUB_CHANGELOG_TOKEN')
  if (!ghToken) return errorResponse('github_token_not_configured', 500)

  const since = new Date(Date.now() - DAYS_BACK * 86400000).toISOString().split('T')[0]
  // Plusieurs qualificateurs repo: dans une même recherche = OR.
  const q = `is:pr is:merged merged:>=${since} ${REPOS.map((r) => `repo:${r}`).join(' ')}`
  const resp = await fetch(
    `https://api.github.com/search/issues?per_page=50&q=${encodeURIComponent(q)}`,
    {
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'memovia-dashboard-changelog',
      },
      signal: AbortSignal.timeout(20_000),
    },
  )
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    console.error('changelog-collect: GitHub API', resp.status, body.slice(0, 200))
    return errorResponse(`github_api_${resp.status}`, 502)
  }
  const { items } = await resp.json() as { items: SearchItem[] }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let inserted = 0
  for (const it of items) {
    const merged = it.pull_request?.merged_at ?? it.closed_at
    if (!merged) continue
    const { error, count } = await supabaseAdmin
      .from('product_milestones')
      .upsert({
        date: merged.split('T')[0],
        repo: it.repository_url.split('/').pop() ?? 'inconnu',
        title: it.title,
        source_url: it.html_url,
        status: 'candidat',
      }, { onConflict: 'source_url', ignoreDuplicates: true, count: 'exact' })
    if (error) { console.error('changelog-collect upsert:', error.message); continue }
    inserted += count ?? 0
  }

  console.log(`changelog-collect terminé: ${items.length} PRs trouvées, ${inserted} candidats insérés`)
  return Response.json({ found: items.length, inserted }, { headers: corsHeaders })
})
```

⚠️ `ignoreDuplicates: true` : un jalon déjà trié (retenu/écarté) ne doit JAMAIS revenir en candidat.

- [ ] **Step 2: `deno check --node-modules-dir=none supabase/functions/changelog-collect/index.ts`** — baseline neuve : zéro erreur attendue (pas d'import imapflow ici).

- [ ] **Step 3: Migration cron 00048** — même mécanisme que 00041 (headers depuis Vault, idempotent) :

```sql
-- Migration 00048 : cron hebdo changelog-collect (lundi 05:30 UTC, avant le briefing de
-- 06:00 : les candidats de la semaine apparaissent dans le briefing du lundi matin).
-- Même mécanisme que 00041 : secrets depuis Vault, réécriture idempotente du job.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'changelog-collect-weekly') then
    perform cron.unschedule('changelog-collect-weekly');
  end if;
end $$;

select cron.schedule(
  'changelog-collect-weekly',
  '30 5 * * 1',
  $$
  select net.http_post(
    url     := 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/changelog-collect',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dashboard_cron_secret')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
```

- [ ] **Step 4: Commit** — `git commit -m "feat(historique): changelog-collect — PRs mergées hebdo en candidats (00048)"`

---

### Task 7: Briefing — trois retouches

**Files:**
- Modify: `supabase/functions/telegram-daily-briefing/index.ts`

**Interfaces:**
- Consomme : `product_milestones` (Task 1), `tasks.lead_id` + FK vers `leads` (Task 1).

- [ ] **Step 1: Exclusion partenaires des leads dormants** — dans la requête `leads` du `Promise.allSettled`, ajouter `.neq('type', 'partenaire')` après `.eq('archived', false)`, avec ce commentaire : `// Les partenaires (type='partenaire') sont gérés en low-touch : la relance « +7j sans contact » serait un mensonge de priorité.`

- [ ] **Step 2: Suffixe fiche sur les tâches échues** — la requête `tasks` sélectionne en plus `lead_id, leads(name)` (join PostgREST via la FK de 00047). Dans le rendu des tâches, après `${qui}` :

```ts
const fiche = (t as { leads?: { name?: string } | null }).leads?.name
lines.push(`• ${prio} ${echapperMarkdown(t.title)}${qui}${fiche ? ` → ${echapperMarkdown(fiche)}` : ''}${retard}`)
```

- [ ] **Step 3: Ligne candidats changelog** — 8e requête dans le `Promise.allSettled` : `supabase.from('product_milestones').select('id', { count: 'exact', head: true }).eq('status', 'candidat')`, destructurée en `milestonesResult`. Rendu (après le bloc Détecteur leads, avant `lines.push('')`) — n'apparaît QUE s'il y a des candidats, une lecture en échec reste silencieuse ici (pas de fausse alerte pour une ligne optionnelle, log console seulement) :

```ts
if (milestonesResult.status === 'fulfilled' && !milestonesResult.value.error) {
  const nCandidats = milestonesResult.value.count ?? 0
  if (nCandidats > 0) {
    lines.push(`🗂 *Historique produit* : ${nCandidats} candidat${nCandidats > 1 ? 's' : ''} à trier · [ouvrir](${DASH}/historique)`)
  }
} else {
  console.error('[briefing] lecture product_milestones en échec')
}
```

- [ ] **Step 4: `deno check` briefing vs baseline (0 erreur), commit** — `git commit -m "feat(briefing): exclusion partenaires, suffixe fiche sur tâches, candidats changelog"`

---

### Task 8: REFONT_PLAN.md + PR

**Files:**
- Modify: `REFONT_PLAN.md` (il fait foi : ajouter une section « Phase 7 — Mémoire d'entreprise (21/08/2026) » listant A-E de la spec avec leur état, et « Historique » dans le tableau des sections)
- La spec `docs/superpowers/specs/2026-08-21-memoire-entreprise-design.md` et ce plan partent dans la même PR.

- [ ] **Step 1: Mettre à jour REFONT_PLAN.md, commit** — `git commit -m "docs: Phase 7 mémoire d'entreprise dans REFONT_PLAN + spec + plan"`
- [ ] **Step 2: Vérifs finales vs baselines** — `npm run typecheck`, `npm test`, `deno check` (briefing + changelog-collect + email-lead-detector intact). Zéro écart nouveau.
- [ ] **Step 3: GATE Naoufel** — confirmation, puis push + PR `feat/memoire-entreprise` (body : résumé spec + vérifs), CI, GATE merge.

---

### Task 9 (post-merge, hors PR): mise en service

- [ ] Migrations 00047 puis 00048 via MCP `apply_migration` (dans cet ordre), vérification `pg_constraint` + `cron.job`.
- [ ] Naoufel : créer le token GitHub fine-grained (lecture seule, 5 dépôts) et `npx supabase secrets set GITHUB_CHANGELOG_TOKEN=…`, puis deploys : `changelog-collect`, `telegram-daily-briefing` (le front part avec le merge, Vercel).
- [ ] Banc de réfutation : invocation manuelle `changelog-collect` par le chemin du cron (pattern 00041) → vérifier `{found, inserted}` cohérents et les lignes `product_milestones` en base ; relire une exécution briefing au prochain matin (candidats + suffixes + absence des partenaires dans les dormants).

### Task 10 (post-deploy, passes validées): backfills

Ordre : partenaires → RDV → jalons → concours. Chaque passe : je propose la liste sourcée (vault/agenda/mails/git — chemin de source cité ligne par ligne), **Naoufel valide**, insertion SQL via MCP, contrôle SELECT. Un RDV sans trace écrite est inséré sans CR ; AUCUNE ligne non validée.

- [ ] Partenaires : fiches Christelle/Compagnons, Paidea, TBS (+ ceux que Naoufel ajoute), `type='partenaire', status='actif'`.
- [ ] RDV historiques : lignes `rdv` datées, `lead_id` vers les fiches, CR au neutre quand une trace écrite existe.
- [ ] Jalons produit : depuis PRs mergées + handoffs + fiches capacités → insertion en `retenu` après validation.
- [ ] Concours passés : lignes `financements` en `gagne/perdu/abandonne` (CRECE…).
