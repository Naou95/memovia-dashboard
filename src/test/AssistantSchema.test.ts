import { describe, it, expect } from 'vitest'
import {
  SCHEMA,
  missingForCreate,
  schemaForPrompt,
  validate,
} from '../../supabase/functions/accueil-assistant/schema'

/**
 * `validate` est la seule barrière entre le modèle et la base : l'edge function
 * accueil-assistant tourne en service role, donc RLS ne rattrape rien. Ces tests
 * couvrent le cas NÉGATIF (ce que le modèle ne doit pas réussir à écrire), pas
 * seulement le chemin heureux.
 */

const resolveOk = async (_table: string, _value: string) => 'uuid-lead-1'
const resolveNone = async (_table: string, _value: string) => null

describe('validate — ce qui doit passer', () => {
  it('accepte une colonne et une valeur d’énumération légitimes', async () => {
    const r = await validate('leads', { status: 'en_discussion', next_action: 'Rappeler' }, resolveNone)
    expect(r).toEqual({ ok: true, patch: { status: 'en_discussion', next_action: 'Rappeler' } })
  })

  it('résout une colonne ref: en uuid à partir du nom donné par le modèle', async () => {
    const r = await validate('rdv', { title: 'Point', lead_id: 'Compagnons' }, resolveOk)
    expect(r.ok && r.patch.lead_id).toBe('uuid-lead-1')
  })

  it('convertit les types simples plutôt que de tout passer en texte', async () => {
    const r = await validate('leads', { archived: 'true' }, resolveNone)
    expect(r.ok && r.patch.archived).toBe(true)
    const n = await validate('contracts', { license_count: '25' }, resolveNone)
    expect(n.ok && n.patch.license_count).toBe(25)
  })

  it('ignore les valeurs vides au lieu d’écraser une colonne', async () => {
    const r = await validate('leads', { next_action: '', notes: null }, resolveNone)
    expect(r).toEqual({ ok: true, patch: {} })
  })
})

describe('validate — ce qui doit être refusé', () => {
  it('refuse une colonne hors schéma (le modèle ne touche pas aux clés)', async () => {
    for (const col of ['id', 'created_by', 'created_at', 'is_admin']) {
      const r = await validate('leads', { [col]: 'x' }, resolveNone)
      expect(r.ok, `colonne ${col} acceptée`).toBe(false)
    }
  })

  it('refuse une valeur d’énumération inventée', async () => {
    const r = await validate('leads', { status: 'super_chaud' }, resolveNone)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toContain('en_discussion')
  })

  it('refuse une table inconnue', async () => {
    const r = await validate('dashboard_profiles', { role: 'admin_full' }, resolveNone)
    expect(r.ok).toBe(false)
  })

  it('refuse une référence introuvable au lieu d’insérer null', async () => {
    const r = await validate('rdv', { lead_id: 'Inexistant' }, resolveNone)
    expect(r.ok).toBe(false)
  })

  it('refuse un nombre non numérique', async () => {
    const r = await validate('contracts', { mrr_eur: 'beaucoup' }, resolveNone)
    expect(r.ok).toBe(false)
  })

  it('refuse un values qui n’est pas un objet', async () => {
    const r = await validate('leads', ['status'] as unknown as Record<string, unknown>, resolveNone)
    expect(r.ok).toBe(false)
  })
})

describe('création', () => {
  it('signale les champs obligatoires manquants', async () => {
    expect(missingForCreate('rdv', { title: 'Point' })).toEqual(['rdv_date'])
    expect(missingForCreate('rdv', { title: 'Point', rdv_date: '2026-08-25T10:00:00+02:00' })).toEqual([])
  })

  it('interdit la création là où le schéma ne la prévoit pas', () => {
    // product_milestones est alimentée par le cron changelog-collect (dédupe sur source_url).
    expect(missingForCreate('product_milestones', { title_public: 'x' })).toBeNull()
  })
})

describe('positionnement (migration 00053)', () => {
  it('accepte une réécriture de contenu', async () => {
    const r = await validate('positionnement_items', { body: 'Nouveau **texte**', style: 'accent' }, resolveNone)
    expect(r).toEqual({ ok: true, patch: { body: 'Nouveau **texte**', style: 'accent' } })
  })

  it('refuse une section ou un verdict inventés', async () => {
    expect((await validate('positionnement_items', { section: 'pricing' }, resolveNone)).ok).toBe(false)
    expect((await validate('positionnement_items', { verdict: 'bleu' }, resolveNone)).ok).toBe(false)
  })

  it('exige la section à la création', () => {
    expect(missingForCreate('positionnement_items', { title: 'x' })).toEqual(['section'])
  })
})

describe('prompt', () => {
  it('décrit chaque table et ses énumérations au modèle', () => {
    const p = schemaForPrompt()
    for (const t of Object.keys(SCHEMA)) expect(p).toContain(t)
    expect(p).toContain('en_discussion')
    expect(p).toContain('création interdite')
  })
})
