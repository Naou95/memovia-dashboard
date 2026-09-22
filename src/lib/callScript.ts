/**
 * Lecture du script d'appel partagé (`dashboard_settings.leads_script`, markdown édité dans
 * Leads › Script & docs). Logique pure, testée par src/test/CallScript.test.ts.
 */

/** La première question de qualification, avant tout le reste (CLAUDE.md MEMOVIA, § 2 ter). */
export const FIRST_QUESTION = 'Combien d’apprentis RQTH avez-vous déclarés cette année ?'

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/** Le texte d'une section `## Titre` du script, sans son titre. null si absente ou encore « à rédiger ». */
export function scriptSection(markdown: string | null | undefined, title: string): string | null {
  if (!markdown) return null
  const lines = markdown.split(/\r?\n/)
  const wanted = norm(title)
  const start = lines.findIndex((l) => /^##\s+/.test(l) && norm(l.replace(/^##\s+/, '')).startsWith(wanted))
  if (start < 0) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => /^#{1,2}\s+/.test(l))
  const body = (end < 0 ? rest : rest.slice(0, end)).join('\n').trim()
  if (!body || /^_?\(?\s*a rediger\s*\)?_?$/.test(norm(body))) return null
  return body
}
