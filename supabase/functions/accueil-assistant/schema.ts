/**
 * Périmètre d'écriture de l'assistant : la SEULE barrière entre le modèle et la
 * base. L'edge function tourne en service role, donc RLS ne protège rien ici —
 * tout ce qui n'est pas listé ci-dessous est refusé.
 *
 * Fichier volontairement sans dépendance Deno/Supabase : il est couvert par
 * src/test/AssistantSchema.test.ts (vitest).
 */

/** Colonne → liste de valeurs permises (enum), ou libellé de type montré au modèle. */
export type ColSpec = string | string[]

export interface TableSpec {
  /** Colonne humaine : sert à retrouver une ligne par son nom. */
  label: string
  cols: Record<string, ColSpec>
  /** Colonnes requises pour créer. Absent = création interdite. */
  create?: string[]
}

const WHO = ['naoufel', 'emir']

export const SCHEMA: Record<string, TableSpec> = {
  leads: {
    label: 'name',
    create: ['name'],
    cols: {
      name: 'texte',
      type: ['ecole', 'cfa', 'entreprise', 'autre', 'partenaire'],
      canal: ['linkedin', 'email', 'referral', 'appel', 'autre'],
      status: ['nouveau', 'contacte', 'en_discussion', 'proposition', 'gagne', 'perdu', 'actif'],
      maturity: ['froid', 'tiede', 'chaud'],
      assigned_to: WHO,
      next_action: 'texte',
      follow_up_date: 'date YYYY-MM-DD',
      last_contact_date: 'date YYYY-MM-DD',
      contact_name: 'texte',
      contact_role: 'texte',
      contact_phone: 'texte',
      contact_email: 'texte',
      notes: 'texte',
      why: 'texte — pourquoi ce lead compte',
      pitch: 'texte — angle de pitch',
      archived: 'booleen (true = sortir de la liste active, remplace la suppression)',
    },
  },
  lead_calls: {
    label: 'note',
    create: ['lead_id', 'outcome'],
    cols: {
      lead_id: 'ref:leads',
      outcome: ['repondu', 'pas_repondu', 'rappel'],
      note: 'texte',
      called_at: 'date/heure ISO 8601',
    },
  },
  rdv: {
    label: 'title',
    create: ['title', 'rdv_date'],
    cols: {
      title: 'texte',
      rdv_date: 'date/heure ISO 8601, ex 2026-08-24T14:30:00+02:00',
      lead_id: 'ref:leads',
      prep: 'texte — notes de préparation',
      cr: 'texte — compte rendu',
      cr_status: ['manquant', 'en_cours', 'fait'],
    },
  },
  financements: {
    label: 'name',
    create: ['name'],
    cols: {
      name: 'texte',
      type: ['concours', 'subvention', 'pret', 'autre'],
      status: ['veille', 'a_deposer', 'depose', 'jury', 'gagne', 'perdu', 'abandonne'],
      deadline: 'date YYYY-MM-DD',
      next_action: 'texte',
      assigned_to: WHO,
      notes: 'texte',
      url: 'texte',
    },
  },
  tasks: {
    label: 'title',
    create: ['title'],
    cols: {
      title: 'texte',
      description: 'texte',
      status: ['todo', 'en_cours', 'done'],
      priority: ['haute', 'normale', 'basse'],
      due_date: 'date YYYY-MM-DD',
      assigned_to: WHO,
      lead_id: 'ref:leads',
      is_private: 'booleen',
    },
  },
  roadmap_items: {
    label: 'title',
    create: ['title'],
    cols: {
      title: 'texte',
      why: 'texte',
      horizon: ['maintenant', 'ensuite', 'plus_tard', 'parque'],
      tag: 'texte',
      ordre: 'entier',
    },
  },
  product_milestones: {
    // Pas de `create` : les candidats viennent du cron changelog-collect, qui
    // dédupe sur source_url. Une insertion à la main casserait cette clé.
    label: 'title',
    cols: {
      title_public: 'texte — libellé montrable au client',
      status: ['candidat', 'retenu', 'ecarte'],
      detail: 'texte',
    },
  },
  feedback_items: {
    label: 'title',
    create: ['title'],
    cols: {
      title: 'texte',
      description: 'texte',
      status: ['backlog', 'planifie', 'en_dev', 'livre'],
      category: ['fonctionnalite', 'bug', 'amelioration'],
      due_date: 'date YYYY-MM-DD',
    },
  },
  positionnement_items: {
    // Le contenu de la page Positionnement (migration 00053). Repéré par `title`,
    // qui n'est PAS unique ici (les intros portent une clé, les puces leur texte) :
    // update_row refuse d'agir quand deux lignes correspondent, ce qui est le
    // garde-fou attendu sur de l'argumentaire commercial.
    label: 'title',
    create: ['section'],
    cols: {
      section: ['intro', 'these', 'phrase', 'interdit', 'citation', 'boucle', 'offre', 'argument', 'concurrent', 'sacrifice'],
      ordre: 'entier — position dans la section',
      title: 'texte — titre de la carte, nom du concurrent, ou la puce elle-même',
      body: 'texte markdown — le contenu principal (** ** pour le gras)',
      note: 'texte markdown — ligne secondaire',
      icon: 'texte — seulement pour section boucle : Mic, Wand2, Radio, Repeat2 ou BadgeCheck',
      segment: 'texte — seulement pour section concurrent',
      verdict: ['rouge', 'orange', 'vert'],
      style: ['plain', 'card', 'accent'],
    },
  },
  contracts: {
    label: 'organization_name',
    create: ['organization_name', 'organization_type'],
    cols: {
      organization_name: 'texte',
      organization_type: ['ecole', 'cfa', 'entreprise', 'autre'],
      status: ['prospect', 'negotiation', 'signe', 'actif', 'resilie'],
      license_count: 'entier',
      mrr_eur: 'nombre',
      renewal_date: 'date YYYY-MM-DD',
      contact_name: 'texte',
      contact_email: 'texte',
      contact_phone: 'texte',
      notes: 'texte',
    },
  },
}

export const TABLES = Object.keys(SCHEMA)

/** Colonne `ref:<table>` : le modèle donne un NOM, on résout l'uuid. */
export function refTarget(spec: ColSpec): string | null {
  return typeof spec === 'string' && spec.startsWith('ref:') ? spec.slice(4) : null
}

/** Schéma rendu lisible pour le prompt système — une seule source de vérité. */
export function schemaForPrompt(): string {
  return TABLES.map((t) => {
    const s = SCHEMA[t]
    const cols = Object.entries(s.cols)
      .map(([c, v]) => `${c} (${Array.isArray(v) ? v.join('|') : v})`)
      .join(', ')
    return `- ${t}${s.create ? '' : ' [création interdite, mise à jour seule]'} — identifié par « ${s.label} » — colonnes : ${cols}`
  }).join('\n')
}

export type Validation =
  | { ok: true; patch: Record<string, unknown> }
  | { ok: false; error: string }

/** Résout un nom en uuid dans la table référencée ; null si introuvable. */
export type ResolveRef = (table: string, value: string) => Promise<string | null>

export async function validate(
  table: string,
  values: Record<string, unknown>,
  resolveRef: ResolveRef,
): Promise<Validation> {
  const spec = SCHEMA[table]
  if (!spec) return { ok: false, error: `Table « ${table} » inconnue. Tables : ${TABLES.join(', ')}.` }
  if (typeof values !== 'object' || values === null || Array.isArray(values)) {
    return { ok: false, error: 'Le paramètre values doit être un objet colonne→valeur.' }
  }

  const patch: Record<string, unknown> = {}

  for (const [col, raw] of Object.entries(values)) {
    const colSpec = spec.cols[col]
    if (!colSpec) {
      return {
        ok: false,
        error: `Colonne « ${col} » non autorisée sur ${table}. Colonnes permises : ${Object.keys(spec.cols).join(', ')}.`,
      }
    }
    if (raw === null || raw === undefined || raw === '') continue

    if (Array.isArray(colSpec)) {
      const v = String(raw)
      if (!colSpec.includes(v)) {
        return { ok: false, error: `Valeur « ${v} » interdite pour ${table}.${col}. Valeurs permises : ${colSpec.join(', ')}.` }
      }
      patch[col] = v
      continue
    }

    const ref = refTarget(colSpec)
    if (ref) {
      const id = await resolveRef(ref, String(raw))
      if (!id) return { ok: false, error: `Aucune ligne « ${raw} » dans ${ref}.` }
      patch[col] = id
      continue
    }

    if (colSpec.startsWith('booleen')) {
      patch[col] = raw === true || raw === 'true'
    } else if (colSpec.startsWith('entier') || colSpec.startsWith('nombre')) {
      const n = Number(raw)
      if (!Number.isFinite(n)) return { ok: false, error: `${table}.${col} attend un nombre, reçu « ${raw} ».` }
      patch[col] = n
    } else {
      patch[col] = String(raw)
    }
  }

  return { ok: true, patch }
}

/** Champs obligatoires manquants pour une création ; null si la création est interdite. */
export function missingForCreate(table: string, patch: Record<string, unknown>): string[] | null {
  const spec = SCHEMA[table]
  if (!spec?.create) return null
  return spec.create.filter((c) => patch[c] === undefined)
}
