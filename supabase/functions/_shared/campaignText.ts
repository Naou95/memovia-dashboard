/**
 * Logique pure des campagnes : assemblage d'un modèle, contrôles avant envoi, interdits.
 * Aucune dépendance Deno ni Supabase : le même fichier est importé par les edge functions
 * et testé par vitest (src/test/CampaignText.test.ts).
 *
 * Conventions du modèle :
 *   {{civilité}} {{nom}}      champs de fusion depuis la fiche du lead
 *   {{IA: consigne}}          zone rédigée par l'IA pour cette cible, rendue entre [[ ]]
 *   {{signature}} {{rgpd}}    blocs fixes
 *   {{objet_precedent}}       objet du mail précédent du fil (relances)
 * Les [[ ]] restent dans le brouillon (surlignage à la revue) et sont retirés à l'envoi.
 */

export const SIGNATURE_EMIR = 'Emir Boutaleb\nCo-fondateur de MEMOVIA\n06 51 53 90 17\nhttps://memovia.io/'

export const RGPD_FOOTER =
  "Vos coordonnées professionnelles proviennent du catalogue national de l'apprentissage (Réseau des Carif-Oref) et du site de votre établissement. MEMOVIA AI, SAS, RCS Toulouse 100 123 777, responsable de traitement, les utilise pour une prospection professionnelle fondée sur son intérêt légitime. Conservation : 3 ans. Droits d'accès, de rectification, d'effacement et d'opposition : contact@memovia.io. Réclamation possible auprès de la CNIL. Pour ne plus être contacté, répondez STOP."

/** Interdits (project_memovia_financement_cfa_rqth, feedback_chiffres_verifiables_supports). */
export const BANNED_PHRASES: { pattern: RegExp; label: string }[] = [
  { pattern: /100\s?%\s*(financ|pris en charge|opco)/i, label: '« 100 % financé par l\'OPCO »' },
  { pattern: /gratuit(e)? pour vous/i, label: '« gratuit pour vous »' },
  { pattern: /partenaire\s+agefiph/i, label: '« partenaire Agefiph »' },
  { pattern: /label+is[ée]e?\s+french\s*tech/i, label: '« labellisée French Tech »' },
  { pattern: /soutenue?\s+par\s+tbseeds/i, label: '« soutenue par TBSeeds »' },
  { pattern: /sous\s+48\s?h/i, label: '« sous 48 h »' },
  { pattern: /\b(5|10|15)\s?minutes\b/i, label: 'une demande de créneau (« 15 minutes »)' },
  { pattern: /je me permets de vous relancer/i, label: '« je me permets de vous relancer »' },
  { pattern: /envoyez[- ]moi (un|une|votre) (support|fiche|document)/i, label: '« envoyez-moi un support »' },
  { pattern: /\bstagiaires?\b/i, label: 'un chiffre « stagiaires » de la liste OF' },
  { pattern: /accord national|logo des compagnons/i, label: 'un accord national ou le logo des Compagnons' },
]

export interface LeadLike {
  name: string
  contact_name?: string | null
  contact_role?: string | null
  contact_email?: string | null
  notes?: string | null
  why?: string | null
  pitch?: string | null
  source?: string | null
}

export interface AiZone {
  index: number
  brief: string
}

/** Zones IA du modèle, dans l'ordre d'apparition. */
export function extractAiZones(template: string): AiZone[] {
  const zones: AiZone[] = []
  const re = /\{\{\s*IA\s*:\s*([\s\S]*?)\}\}/g
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(template)) !== null) {
    zones.push({ index: i++, brief: m[1].trim() })
  }
  return zones
}

/** « Madame » / « Monsieur » depuis le prénom, sinon vide. Une civilité fausse coûte plus qu'une absence. */
export function guessCivility(contactName: string | null | undefined): string {
  const first = (contactName || '').trim().split(/\s+/)[0]?.toLowerCase() || ''
  if (!first) return ''
  const female = ['fabienne', 'anne', 'marie', 'sylvie', 'karine', 'myriam', 'élodie', 'elodie', 'gina', 'anaïs', 'anais', 'christelle', 'shirley', 'zakia', 'antoaneta', 'florence', 'nathalie', 'isabelle', 'sandrine', 'stéphanie', 'stephanie', 'julie', 'laurence', 'céline', 'celine', 'agnès', 'agnes', 'claudine', 'véronique', 'veronique', 'catherine', 'emmanuelle', 'julia', 'marina', 'nelly', 'sabine', 'cindy', 'camille', 'laetitia', 'nabila', 'marine', 'calypso', 'géraldine', 'geraldine', 'ophélie', 'ophelie', 'solène', 'solene', 'muriel', 'patricia', 'émilie', 'emilie', 'valérie', 'valerie', 'magali', 'tiffany', 'vanessa', 'cécile', 'cecile', 'manon', 'maria', 'alessia', 'louise', 'eléa', 'elea']
  const male = ['olivier', 'cyril', 'simon', 'benoît', 'benoit', 'ludovic', 'arnaud', 'david', 'mathieu', 'pierre', 'laurent', 'christophe', 'fabrice', 'yannick', 'sébastien', 'sebastien', 'abbes', 'edgar', 'rudy', 'guillaume', 'nicolas', 'yann', 'nathanaël', 'nathanael', 'armel', 'emir', 'naoufel', 'antoine', 'thomas', 'julien', 'maxence', 'hamed']
  if (female.includes(first)) return 'Madame'
  if (male.includes(first)) return 'Monsieur'
  return ''
}

/** Nom de famille (dernier mot) pour « Bonjour Madame Vernadat ». */
export function lastName(contactName: string | null | undefined): string {
  const parts = (contactName || '').trim().split(/\s+/).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || ''
}

export interface AssembleInput {
  template: string
  zones: string[]
  lead: LeadLike
  previousSubject?: string | null
}

/** Remplace les champs de fusion et pose les zones IA entre [[ ]]. */
export function assembleBody({ template, zones, lead, previousSubject }: AssembleInput): string {
  let i = 0
  const civ = guessCivility(lead.contact_name)
  const name = lastName(lead.contact_name)
  let out = template.replace(/\{\{\s*IA\s*:[\s\S]*?\}\}/g, () => {
    const z = (zones[i++] || '').trim()
    return z ? `[[${z}]]` : ''
  })
  out = out
    .replace(/\{\{\s*civilité\s*\}\}\s*\{\{\s*nom\s*\}\}/g, civ && name ? `${civ} ${name}` : name || civ || '')
    .replace(/\{\{\s*civilité\s*\}\}/g, civ)
    .replace(/\{\{\s*nom\s*\}\}/g, name)
    .replace(/\{\{\s*signature\s*\}\}/g, SIGNATURE_EMIR)
    .replace(/\{\{\s*rgpd\s*\}\}/g, RGPD_FOOTER)
    .replace(/\{\{\s*objet_precedent\s*\}\}/g, previousSubject || '')
  // « Bonjour  , » quand rien n'est connu
  out = out.replace(/Bonjour\s+,/g, 'Bonjour,')
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

export function assembleSubject(template: string | null | undefined, zoneText: string | null | undefined, previousSubject?: string | null): string {
  const t = template || ''
  if (/\{\{\s*IA\s*:/.test(t)) return (zoneText || '').trim()
  return t.replace(/\{\{\s*objet_precedent\s*\}\}/g, (previousSubject || '').replace(/^re:\s*/i, '')).trim()
}

/** Retire les marqueurs [[ ]] : c'est le texte qui part. */
export function stripAiMarks(body: string): string {
  return body.replace(/\[\[/g, '').replace(/\]\]/g, '')
}

/** Nombre de mots hors signature et pied RGPD. */
export function wordCount(body: string): number {
  let core = stripAiMarks(body)
  const sigIdx = core.indexOf('Emir Boutaleb\n')
  if (sigIdx > 0) core = core.slice(0, sigIdx)
  return core.split(/\s+/).filter(Boolean).length
}

export interface Check {
  status: 'ok' | 'warn' | 'ko'
  label: string
}

export interface CheckInput {
  subject: string
  body: string
  isReply: boolean
  hasThread: boolean
  isFirst: boolean
}

/** Les contrôles montrés à la revue. Un « ko » bloque l'envoi. */
export function runChecks({ subject, body, isReply, hasThread, isFirst }: CheckInput): Check[] {
  const checks: Check[] = []
  const text = stripAiMarks(body)
  const words = wordCount(body)
  checks.push(words <= 170
    ? { status: 'ok', label: `${words} mots hors signature (max 170)` }
    : { status: 'warn', label: `${words} mots hors signature, au-dessus de 170` })

  const core = text.split('Emir Boutaleb\n')[0]
  const questions = (core.match(/\?/g) || []).length
  checks.push(questions === 1
    ? { status: 'ok', label: 'Une seule question' }
    : questions === 0
      ? { status: 'warn', label: 'Aucune question' }
      : { status: 'warn', label: `${questions} questions, il n'en faut qu'une` })

  const banned = BANNED_PHRASES.filter((b) => b.pattern.test(text) || b.pattern.test(subject))
  checks.push(banned.length === 0
    ? { status: 'ok', label: 'Aucun interdit' }
    : { status: 'ko', label: `Interdit : ${banned.map((b) => b.label).join(', ')}` })

  if (isReply) {
    checks.push(hasThread
      ? { status: 'ok', label: 'Réponse dans le fil du premier mail' }
      : { status: 'warn', label: 'Pas de fil : partira comme un nouveau mail' })
  }

  checks.push(text.includes('Emir Boutaleb')
    ? { status: 'ok', label: 'Signature Emir' }
    : { status: 'warn', label: 'Signature absente' })

  if (isFirst) {
    checks.push(text.includes('répondez STOP')
      ? { status: 'ok', label: 'Pied RGPD présent' }
      : { status: 'ko', label: 'Pied RGPD absent sur un premier mail' })
  }

  if (!subject.trim()) checks.push({ status: 'ko', label: 'Objet vide' })
  if (/\{\{|\}\}/.test(text) || /\{\{|\}\}/.test(subject)) checks.push({ status: 'ko', label: 'Un champ {{ }} non rempli' })

  return checks
}

export function hasBlockingCheck(checks: Check[]): boolean {
  return checks.some((c) => c.status === 'ko')
}

/** Contexte lisible de la fiche lead pour le prompt et le panneau « ce que l'IA a lu ». */
export function leadFacts(lead: LeadLike): [string, string][] {
  const facts: [string, string][] = []
  if (lead.contact_name) facts.push(['Contact', `${lead.contact_name}${lead.contact_role ? ', ' + lead.contact_role : ''}`])
  if (lead.source) facts.push(['Source', lead.source])
  if (lead.why) facts.push(['Pourquoi ce lead', lead.why])
  if (lead.notes) {
    for (const line of lead.notes.split('\n')) {
      const m = line.match(/^\s*([^:]{2,40}):\s*(.+)$/)
      if (m) facts.push([m[1].trim(), m[2].trim()])
    }
  }
  return facts
}
