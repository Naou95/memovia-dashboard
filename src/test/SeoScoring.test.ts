import { describe, it, expect } from 'vitest'

// ── Extracted scoring functions (mirrored from ArticleEditor.tsx) ─────────────
// We duplicate minimal logic here so tests don't require JSDOM + React render.
// If scoring logic changes in ArticleEditor.tsx, update these mirrors too.

const FR_STOPWORDS = new Set([
  'le', 'la', 'les', 'de', 'du', 'des', 'en', 'et', 'ou', 'pour',
  'par', 'sur', 'avec', 'dans', 'un', 'une', 'ce', 'se', 'sa', 'son',
  'ses', 'qui', 'que', 'au', 'aux',
])

function extractKeywordFromH1(content: string): string {
  const htmlMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i)
  const h1Text = htmlMatch
    ? htmlMatch[1].replace(/<[^>]+>/g, '').trim()
    : (content.match(/^# (.+)/m)?.[1]?.trim() ?? '')
  if (!h1Text) return ''
  return h1Text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FR_STOPWORDS.has(w))
    .slice(0, 4)
    .join(' ')
}

interface ScoreCheck { label: string; pass: boolean; points: number }

function calculateSeoScore(content: string, metaDescription: string, excerpt: string, coverImageUrl: string): { score: number; checks: ScoreCheck[] } {
  const kw = extractKeywordFromH1(content)
  const textContent = content.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const words = textContent ? textContent.split(/\s+/) : []
  const wordCount = words.length
  const first150 = words.slice(0, 150).join(' ').toLowerCase()
  const h2HtmlCount = (content.match(/<h2[\s>]/gi) ?? []).length
  const h2MdCount = (content.match(/^## /gm) ?? []).length
  const h2Count = h2HtmlCount + h2MdCount
  const checks: ScoreCheck[] = [
    { label: 'Mot-clé présent dans le H1', pass: kw.length > 0, points: 20 },
    { label: 'Mot-clé dans les 150 premiers mots', pass: kw.length > 0 && first150.includes(kw), points: 15 },
    { label: 'Mot-clé dans la meta description', pass: kw.length > 0 && metaDescription.toLowerCase().includes(kw), points: 15 },
    { label: 'Longueur contenu (800-1400 mots)', pass: wordCount >= 800 && wordCount <= 1400, points: 20 },
    { label: 'Au moins 3 sous-titres H2', pass: h2Count >= 3, points: 10 },
    { label: 'Extrait renseigné', pass: excerpt.trim().length > 0, points: 10 },
    { label: 'Image de couverture définie', pass: coverImageUrl.trim().length > 0, points: 10 },
  ]
  const score = checks.reduce((sum, c) => sum + (c.pass ? c.points : 0), 0)
  return { score, checks }
}

function calculateGeoScore(content: string): { score: number; checks: ScoreCheck[] } {
  const text = content.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const words = text ? text.split(/\s+/) : []
  const wordCount = words.length
  const h3HtmlCount = (content.match(/<h3[\s>]/gi) ?? []).length
  const h3MdCount = (content.match(/^### .+/gm) ?? []).length
  const hasQA = (h3HtmlCount + h3MdCount) >= 2
  const factualMatches = (text.match(/\b\d[\d\s,.]*(%|€|\$|milliard|million|k\b|md\b)/gi) ?? [])
  const hasFactualCitations = factualMatches.length >= 3
  const hasSchema = /<script[^>]+type=["']application\/ld\+json["']/i.test(content)
  const optimalLength = wordCount >= 800 && wordCount <= 1400
  const definitionMatches = (text.match(/\b\w+ (est |se définit|désigne|correspond à)/g) ?? [])
  const hasDefinitions = definitionMatches.length >= 2
  const longWords = words.filter((w) => w.length > 12).length
  const longWordRatio = wordCount > 0 ? longWords / wordCount : 1
  const isConversational = wordCount > 0 && longWordRatio < 0.08
  const checks: ScoreCheck[] = [
    { label: 'Structure Q&A (≥2 sous-titres H3)', pass: hasQA, points: 20 },
    { label: 'Citations factuelles (≥3)', pass: hasFactualCitations, points: 20 },
    { label: 'Schema JSON-LD', pass: hasSchema, points: 15 },
    { label: 'Longueur optimale (800-1400 mots)', pass: optimalLength, points: 15 },
    { label: 'Définitions (≥2)', pass: hasDefinitions, points: 15 },
    { label: 'Langage naturel', pass: isConversational, points: 15 },
  ]
  const score = checks.reduce((sum, c) => sum + (c.pass ? c.points : 0), 0)
  return { score, checks }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWords(n: number): string {
  return Array.from({ length: n }, (_, i) => `mot${i}`).join(' ')
}

// ── calculateSeoScore ─────────────────────────────────────────────────────────

describe('calculateSeoScore', () => {
  it('score = 0 quand tout est vide', () => {
    const { score } = calculateSeoScore('', '', '', '')
    expect(score).toBe(0)
  })

  it('score = 100 sur un article parfait', () => {
    const content = `# logiciel CFA\n${makeWords(900)}\n## Section 1\n## Section 2\n## Section 3`
    const { score } = calculateSeoScore(content, 'logiciel cfa description', 'extrait', 'https://img.jpg')
    expect(score).toBe(100)
  })

  it('wordCount boundary : 799 mots → longueur échoue', () => {
    // makeWords(N) generates N tokens; plain text without H1 prefix to keep count exact
    const content = makeWords(799)
    const { checks } = calculateSeoScore(content, '', '', '')
    const lengthCheck = checks.find((c) => c.label.includes('Longueur'))!
    expect(lengthCheck.pass).toBe(false)
  })

  it('wordCount boundary : 800 mots → longueur passe', () => {
    const content = makeWords(800)
    const { checks } = calculateSeoScore(content, '', '', '')
    const lengthCheck = checks.find((c) => c.label.includes('Longueur'))!
    expect(lengthCheck.pass).toBe(true)
  })

  it('wordCount boundary : 1401 mots → longueur échoue', () => {
    const content = makeWords(1401)
    const { checks } = calculateSeoScore(content, '', '', '')
    const lengthCheck = checks.find((c) => c.label.includes('Longueur'))!
    expect(lengthCheck.pass).toBe(false)
  })

  it('extrait vide → check échoue', () => {
    const { checks } = calculateSeoScore('', '', '', '')
    expect(checks.find((c) => c.label.includes('Extrait'))!.pass).toBe(false)
  })

  it('extrait non vide → check passe', () => {
    const { checks } = calculateSeoScore('', '', 'Mon extrait', '')
    expect(checks.find((c) => c.label.includes('Extrait'))!.pass).toBe(true)
  })

  it('H1 HTML détecté correctement', () => {
    const content = `<h1>logiciel CFA</h1>${makeWords(850)}`
    const { checks } = calculateSeoScore(content, '', '', '')
    expect(checks[0].pass).toBe(true)
  })
})

// ── calculateGeoScore ─────────────────────────────────────────────────────────

describe('calculateGeoScore', () => {
  it('score = 0 sur contenu vide', () => {
    expect(calculateGeoScore('').score).toBe(0)
  })

  it('score = 100 avec tous les critères remplis', () => {
    const schema = `<script type="application/ld+json">{}</script>`
    const content = `
${schema}
### Qu'est-ce qu'un CFA ?
### Comment fonctionne la formation ?
${makeWords(900)}
En 2024, 45% des organismes ont adopté ce logiciel. Avec 120 000€ d'économies et 3 milliards de données traitées.
Un CFA est un centre de formation. Le logiciel désigne un outil numérique. correspond à une solution complète.
`
    const { score } = calculateGeoScore(content)
    expect(score).toBe(100)
  })

  it('H3 Markdown détecté : ≥2 → Q&A passe', () => {
    const content = `### Question un ?\n### Question deux ?\n${makeWords(100)}`
    const { checks } = calculateGeoScore(content)
    expect(checks.find((c) => c.label.includes('Q&A'))!.pass).toBe(true)
  })

  it('H3 HTML détecté', () => {
    const content = `<h3>Question ?</h3><h3>Autre question ?</h3>${makeWords(100)}`
    const { checks } = calculateGeoScore(content)
    expect(checks.find((c) => c.label.includes('Q&A'))!.pass).toBe(true)
  })

  it('1 seul H3 → Q&A échoue', () => {
    const content = `### Une seule question ?\n${makeWords(100)}`
    const { checks } = calculateGeoScore(content)
    expect(checks.find((c) => c.label.includes('Q&A'))!.pass).toBe(false)
  })

  it('3 citations factuelles avec % → passe', () => {
    const content = `${makeWords(100)} 45% des cas. 12€ par mois. 3 milliards de données.`
    const { checks } = calculateGeoScore(content)
    expect(checks.find((c) => c.label.includes('Citations'))!.pass).toBe(true)
  })

  it('2 citations → échoue (besoin de 3)', () => {
    const content = `${makeWords(100)} 45% des cas. 12€ par mois.`
    const { checks } = calculateGeoScore(content)
    expect(checks.find((c) => c.label.includes('Citations'))!.pass).toBe(false)
  })

  it('schema JSON-LD présent → passe', () => {
    const content = `<script type="application/ld+json">{}</script>${makeWords(100)}`
    const { checks } = calculateGeoScore(content)
    expect(checks.find((c) => c.label.includes('Schema'))!.pass).toBe(true)
  })

  it('pas de schema → échoue', () => {
    const { checks } = calculateGeoScore(makeWords(100))
    expect(checks.find((c) => c.label.includes('Schema'))!.pass).toBe(false)
  })

  it('longueur boundary 800 mots → passe', () => {
    const { checks } = calculateGeoScore(makeWords(800))
    expect(checks.find((c) => c.label.includes('Longueur'))!.pass).toBe(true)
  })

  it('longueur boundary 799 mots → échoue', () => {
    const { checks } = calculateGeoScore(makeWords(799))
    expect(checks.find((c) => c.label.includes('Longueur'))!.pass).toBe(false)
  })
})

// ── canPublish gate ───────────────────────────────────────────────────────────

describe('canPublish gate logic', () => {
  function canPublish(seoScore: number, geoScore: number, isEditMode: boolean): boolean {
    return isEditMode ? seoScore >= 60 : seoScore >= 60 && geoScore >= 60
  }

  it('nouveau article : SEO≥60 et GEO≥60 → actif', () => {
    expect(canPublish(80, 80, false)).toBe(true)
  })

  it('nouveau article : SEO≥60 mais GEO<60 → bloqué', () => {
    expect(canPublish(80, 40, false)).toBe(false)
  })

  it('nouveau article : SEO<60 → bloqué', () => {
    expect(canPublish(40, 80, false)).toBe(false)
  })

  it('nouveau article : les deux à 59 → bloqué', () => {
    expect(canPublish(59, 59, false)).toBe(false)
  })

  it('edit mode : SEO≥60 suffit même si GEO<60', () => {
    expect(canPublish(80, 0, true)).toBe(true)
  })

  it('edit mode : SEO<60 → bloqué', () => {
    expect(canPublish(50, 90, true)).toBe(false)
  })

  it('boundary exact : SEO=60, GEO=60 → actif (nouveau)', () => {
    expect(canPublish(60, 60, false)).toBe(true)
  })
})
