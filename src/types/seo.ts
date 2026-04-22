export type ArticleStatus = 'draft' | 'published' | 'archived'

export interface BlogCategory {
  id: string
  name: string
  slug: string
  description: string | null
  created_at: string
}

export interface BlogArticle {
  id: string
  title: string
  slug: string
  content: string | null
  excerpt: string | null
  keyword: string | null
  status: ArticleStatus
  category_id: string | null
  blog_categories?: Pick<BlogCategory, 'id' | 'name' | 'slug'> | null
  meta_title: string | null
  meta_description: string | null
  reading_time: number | null
  cover_image_url: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface SerpResult {
  position: number
  title: string
  url: string
  description: string
}

export interface SerpAnalysis {
  keyword: string
  total_results: number
  results: SerpResult[]
  paa: string[]
}

export interface GeneratedArticle {
  title: string
  meta_title: string
  meta_description: string
  excerpt: string
  content: string
  reading_time: number
  suggested_slug: string
  cover_image_url?: string | null
  internal_linking_suggestions?: string[] | null
  paa_used?: string[] | null
}

export interface SeoGenerateResponse {
  serp: SerpAnalysis
  article: GeneratedArticle
}

export interface ArticleCreatePayload {
  title: string
  slug: string
  content: string
  excerpt?: string
  keyword?: string
  status?: ArticleStatus
  category_id?: string
  meta_title?: string
  meta_description?: string
  reading_time?: number
  cover_image_url?: string
}

export type GenerationStep =
  | 'idle'
  | 'analyzing_serp'
  | 'fetching_competitors'
  | 'analyzing_competitors'
  | 'generating_article'
  | 'generating_cover'
  | 'done'
  | 'error'

export interface SeoSuggestion {
  keyword: string
  title: string
  angle: string
  volume: number
  opportunity_score: number
  why_now: string
}

export interface SeoSeed {
  id: string
  keyword: string
  created_at: string
}

export interface SeoSuggestionsResponse {
  suggestions: SeoSuggestion[]
}

// ── Keyword Research ──────────────────────────────────────────────────────────

export interface KeywordTrend {
  year: number
  month: number
  search_volume: number
}

export interface KeywordResearchResult {
  keyword: string
  search_volume: number
  competition: number | null     // 0-1 from Google Ads
  competition_level: 'LOW' | 'MEDIUM' | 'HIGH' | null
  cpc: number | null             // CPC en €
  keyword_difficulty: number     // estimé 0-100
  trend: KeywordTrend[]          // 12 derniers mois
  related_keywords: RelatedKeyword[]
}

export interface RelatedKeyword {
  keyword: string
  search_volume: number
  competition_level: 'LOW' | 'MEDIUM' | 'HIGH' | null
  cpc: number | null
}

// ── Competitor Analysis ───────────────────────────────────────────────────────

export interface CompetitorPage {
  url: string
  title: string
  traffic_share: number         // % du trafic organique du domaine
  etv: number | null            // estimated traffic value
}

export interface ContentGap {
  topic: string
  why: string                   // pourquoi c'est une opportunité pour MEMOVIA
  estimated_volume: number | null
}

export interface CompetitorAnalysisResult {
  domain: string
  top_pages: CompetitorPage[]
  content_gaps: ContentGap[]
}

// ── Backlinks ─────────────────────────────────────────────────────────────────

export interface BacklinkTopPage {
  url: string
  backlinks_count: number
  referring_domains: number
}

export interface BacklinksResult {
  domain: string
  total_backlinks: number
  referring_domains: number
  domain_rank: number | null    // DR estimé
  top_pages: BacklinkTopPage[]
}
