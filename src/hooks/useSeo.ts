import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type {
  BlogArticle,
  BlogCategory,
  ArticleCreatePayload,
  SeoGenerateResponse,
  GenerationStep,
} from '@/types/seo'

interface UseSeoResult {
  // Articles list
  articles: BlogArticle[]
  categories: BlogCategory[]
  isLoading: boolean
  error: string | null
  fetchArticles: () => Promise<void>

  // Generation flow
  generationStep: GenerationStep
  generateResult: SeoGenerateResponse | null
  generate: (keyword: string, theme: string) => Promise<void>
  resetGeneration: () => void

  // CRUD
  saveArticle: (payload: ArticleCreatePayload) => Promise<BlogArticle | null>
  updateArticle: (id: string, payload: Partial<ArticleCreatePayload>) => Promise<BlogArticle | null>
  publishArticle: (id: string) => Promise<void>
  archiveArticle: (id: string) => Promise<void>
  deleteArticle: (id: string) => Promise<void>
}

export function useSeo(): UseSeoResult {
  const [articles, setArticles] = useState<BlogArticle[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [generationStep, setGenerationStep] = useState<GenerationStep>('idle')
  const [generateResult, setGenerateResult] = useState<SeoGenerateResponse | null>(null)

  const fetchArticles = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const [articlesRes, categoriesRes] = await Promise.all([
      supabase.functions.invoke<{ articles: BlogArticle[] }>('seo-articles', {
        body: { action: 'list' },
      }),
      supabase.functions.invoke<{ categories: BlogCategory[] }>('seo-articles', {
        body: { action: 'categories' },
      }),
    ])

    if (articlesRes.error) {
      setError('Impossible de charger les articles')
    } else {
      setArticles(articlesRes.data?.articles ?? [])
    }

    if (!categoriesRes.error) {
      setCategories(categoriesRes.data?.categories ?? [])
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  const generate = useCallback(async (keyword: string, theme: string) => {
    setGenerationStep('analyzing_serp')
    setGenerateResult(null)

    try {
      // Step 1 label — the Edge Function handles both SERP + Claude sequentially
      setGenerationStep('generating_article')

      const { data, error } = await supabase.functions.invoke<SeoGenerateResponse>(
        'seo-generate',
        { body: { keyword, theme } },
      )

      if (error) throw new Error(error.message)
      if (!data) throw new Error('Réponse vide')

      if (data.article.cover_image_url) {
        setGenerationStep('generating_cover')
        await new Promise((r) => setTimeout(r, 800))
      }

      setGenerateResult(data)
      setGenerationStep('done')
      toast.success('Article généré avec succès')
    } catch (err) {
      setGenerationStep('error')
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error(`Échec de la génération : ${msg}`)
    }
  }, [])

  const resetGeneration = useCallback(() => {
    setGenerationStep('idle')
    setGenerateResult(null)
  }, [])

  const updateArticle = useCallback(async (id: string, payload: Partial<ArticleCreatePayload>): Promise<BlogArticle | null> => {
    const { data, error } = await supabase.functions.invoke<{ article: BlogArticle }>(
      'seo-articles',
      { body: { action: 'update', data: { id, ...payload } } },
    )

    if (error || !data) {
      toast.error("Impossible de mettre à jour l'article")
      return null
    }

    toast.success('Article mis à jour')
    await fetchArticles()
    return data.article
  }, [fetchArticles])

  const saveArticle = useCallback(async (payload: ArticleCreatePayload): Promise<BlogArticle | null> => {
    const { data, error } = await supabase.functions.invoke<{ article: BlogArticle }>(
      'seo-articles',
      { body: { action: 'create', data: payload } },
    )

    if (error || !data) {
      toast.error('Impossible de sauvegarder l\'article')
      return null
    }

    toast.success('Article sauvegardé')
    await fetchArticles()
    return data.article
  }, [fetchArticles])

  const publishArticle = useCallback(async (id: string) => {
    const { error } = await supabase.functions.invoke('seo-articles', {
      body: { action: 'publish', id },
    })

    if (error) {
      toast.error('Impossible de publier l\'article')
      return
    }

    toast.success('Article publié')
    await fetchArticles()
  }, [fetchArticles])

  const archiveArticle = useCallback(async (id: string) => {
    const { error } = await supabase.functions.invoke('seo-articles', {
      body: { action: 'archive', id },
    })

    if (error) {
      toast.error('Impossible d\'archiver l\'article')
      return
    }

    toast.success('Article archivé')
    await fetchArticles()
  }, [fetchArticles])

  const deleteArticle = useCallback(async (id: string) => {
    const { error } = await supabase.functions.invoke('seo-articles', {
      body: { action: 'delete', id },
    })

    if (error) {
      toast.error('Impossible de supprimer l\'article')
      return
    }

    toast.success('Article supprimé')
    setArticles((prev) => prev.filter((a) => a.id !== id))
  }, [])

  return {
    articles,
    categories,
    isLoading,
    error,
    fetchArticles,
    generationStep,
    generateResult,
    generate,
    resetGeneration,
    saveArticle,
    updateArticle,
    publishArticle,
    archiveArticle,
    deleteArticle,
  }
}
