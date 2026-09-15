/**
 * Parseur CSV des contacts de campagne (spec docs/superpowers/specs/2026-09-15-campagnes-design.md).
 * Deux formats reconnus :
 *  - la liste du 13/09 (« Établissement », « Email du catalogue », « Ville du siège »…) : les
 *    colonnes descriptives deviennent des lignes « Clé: valeur » dans les notes du lead ;
 *  - un format générique (name|nom|établissement, email, contact_name|contact,
 *    contact_role|fonction, phone|téléphone).
 * Pur, sans Supabase : testé par src/test/CampaignCsv.test.ts.
 */

export interface CsvContact {
  name: string
  contact_email: string
  contact_name: string | null
  contact_role: string | null
  contact_phone: string | null
  notes: string | null
}

export interface ParsedCsv {
  contacts: CsvContact[]
  /** Lignes ignorées faute d'email ou de nom. */
  skipped: number
}

/** Colonnes de la liste du 13/09 qui ne doivent pas atterrir dans les notes. */
const IGNORED_13_09 = ['siret', 'uai', 'stagiaires declares', 'formateurs declares']

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Séparateur : celui qui apparaît le plus sur la ligne d'en-tête, `;` gagnant les égalités (Excel FR). */
function detectSeparator(headerLine: string): ',' | ';' {
  const commas = (headerLine.match(/,/g) || []).length
  const semis = (headerLine.match(/;/g) || []).length
  return semis >= commas ? ';' : ','
}

/** Découpe un CSV en lignes de cellules : guillemets doublés, retours à la ligne dans les guillemets. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] || ''
  const sep = detectSeparator(firstLine)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += c
    } else if (c === '"') {
      quoted = true
    } else if (c === sep) {
      row.push(cell); cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      rows.push(row); row = []
    } else cell += c
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

/** Première adresse d'une cellule « a@x.fr, b@x.fr », en minuscules ; '' si rien d'exploitable. */
export function firstEmail(cell: string): string {
  const first = cell.split(/[,;\s]+/).map((s) => s.trim()).find(Boolean) || ''
  return first.includes('@') ? first.toLowerCase() : ''
}

function findCol(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) => candidates.includes(h))
}

export function parseCampaignCsv(text: string): ParsedCsv {
  const rows = parseCsv(text)
  if (rows.length < 2) return { contacts: [], skipped: 0 }
  const rawHeaders = rows[0].map((h) => h.trim())
  const headers = rawHeaders.map(normalize)

  const is1309 = headers.includes('etablissement') && headers.includes('email du catalogue')
  const nameCol = is1309
    ? headers.indexOf('etablissement')
    : findCol(headers, ['name', 'nom', 'etablissement'])
  const emailCol = is1309
    ? headers.indexOf('email du catalogue')
    : headers.findIndex((h) => h === 'email' || h === 'e mail' || h === 'mail' || h.includes('email'))
  const contactCol = is1309 ? -1 : findCol(headers, ['contact name', 'contact', 'nom du contact'])
  const roleCol = is1309 ? -1 : findCol(headers, ['contact role', 'fonction', 'role'])
  const phoneCol = is1309 ? -1 : findCol(headers, ['phone', 'telephone', 'tel'])
  if (nameCol < 0 || emailCol < 0) return { contacts: [], skipped: rows.length - 1 }

  const noteCols = is1309
    ? headers
        .map((_, i) => i)
        .filter((i) => i !== nameCol && i !== emailCol && !IGNORED_13_09.includes(headers[i]) && rawHeaders[i] !== '')
    : []

  const contacts: CsvContact[] = []
  let skipped = 0
  for (const row of rows.slice(1)) {
    const name = (row[nameCol] || '').trim()
    const email = firstEmail(row[emailCol] || '')
    if (!name || !email) { skipped++; continue }
    const notes = noteCols
      .map((i) => [rawHeaders[i], (row[i] || '').trim()] as const)
      .filter(([, v]) => v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')
    const pick = (i: number) => (i >= 0 && (row[i] || '').trim()) || null
    contacts.push({
      name,
      contact_email: email,
      contact_name: pick(contactCol),
      contact_role: pick(roleCol),
      contact_phone: pick(phoneCol),
      notes: notes || null,
    })
  }
  return { contacts, skipped }
}
