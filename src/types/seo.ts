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
  content: string
  excerpt: string | null
  keyword: string | null
  status: ArticleStatus
  category_id: string | null
  blog_categories?: Pick<BlogCategory, 'id' | 'name' | 'slug'> | null
  meta_title: string | null
  meta_description: string | null
  reading_time: number | null
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
}

export interface GeneratedArticle {
  title: string
  meta_title: string
  meta_description: string
  excerpt: string
  content: string
  reading_time: number
  suggested_slug: string
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
}

export type GenerationStep =
  | 'idle'
  | 'fetching_serp'
  | 'generating_article'
  | 'done'
  | 'error'
