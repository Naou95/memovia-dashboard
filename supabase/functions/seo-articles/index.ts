import { createClient } from 'jsr:@supabase/supabase-js@2'
import { marked } from 'https://esm.sh/marked@9'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

function mdToHtml(md: string): string {
  if (!md) return ''
  if (md.trimStart().startsWith('<')) return md
  return marked.parse(md) as string
}

type ArticleStatus = 'draft' | 'published' | 'archived'

interface ArticleCreatePayload {
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

interface ArticleUpdatePayload extends Partial<ArticleCreatePayload> {
  id: string
}

function getAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult

  const supabase = getAdminClient()

  try {
    const body = await req.json()
    const action: string = body.action ?? ''

    switch (action) {
      case 'list': {
        const { data, error } = await supabase
          .from('blog_articles')
          .select(`
            id, title, slug, content, excerpt, keyword, status,
            meta_title, meta_description, reading_time, cover_image_url,
            created_at, updated_at, published_at,
            category_id, blog_categories(id, name, slug)
          `)
          .order('created_at', { ascending: false })

        if (error) throw error
        return Response.json({ articles: data }, { headers: corsHeaders })
      }

      case 'categories': {
        const { data, error } = await supabase
          .from('blog_categories')
          .select('*')
          .order('name')

        if (error) throw error
        return Response.json({ categories: data }, { headers: corsHeaders })
      }

      case 'create': {
        const payload: ArticleCreatePayload = body.data
        if (!payload?.title || !payload?.slug) {
          return errorResponse('title_and_slug_required', 400)
        }

        const { data, error } = await supabase
          .from('blog_articles')
          .insert({
            title: payload.title,
            slug: payload.slug,
            content: mdToHtml(payload.content ?? ''),
            excerpt: payload.excerpt ?? null,
            keyword: payload.keyword ?? null,
            status: payload.status ?? 'draft',
            category_id: payload.category_id ?? null,
            meta_title: payload.meta_title ?? null,
            meta_description: payload.meta_description ?? null,
            reading_time: payload.reading_time ?? null,
            cover_image_url: payload.cover_image_url ?? null,
          })
          .select()
          .single()

        if (error) {
          if (error.code === '23505') return errorResponse('slug_already_exists', 409)
          throw error
        }
        return Response.json({ article: data }, { headers: corsHeaders })
      }

      case 'update': {
        const payload: ArticleUpdatePayload = body.data
        if (!payload?.id) return errorResponse('id_required', 400)

        const { id, ...fields } = payload
        if (fields.content !== undefined) {
          fields.content = mdToHtml(fields.content)
        }
        const { data, error } = await supabase
          .from('blog_articles')
          .update(fields)
          .eq('id', id)
          .select()
          .single()

        if (error) throw error
        return Response.json({ article: data }, { headers: corsHeaders })
      }

      case 'publish': {
        const { id } = body
        if (!id) return errorResponse('id_required', 400)

        const { data, error } = await supabase
          .from('blog_articles')
          .update({ status: 'published', published_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()

        if (error) throw error
        return Response.json({ article: data }, { headers: corsHeaders })
      }

      case 'archive': {
        const { id } = body
        if (!id) return errorResponse('id_required', 400)

        const { data, error } = await supabase
          .from('blog_articles')
          .update({ status: 'archived' })
          .eq('id', id)
          .select()
          .single()

        if (error) throw error
        return Response.json({ article: data }, { headers: corsHeaders })
      }

      case 'delete': {
        const { id } = body
        if (!id) return errorResponse('id_required', 400)

        console.log('[seo-articles] delete attempt, id:', id)
        const { error } = await supabase
          .from('blog_articles')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('[seo-articles] delete DB error:', JSON.stringify({ code: error.code, message: error.message, details: error.details, hint: error.hint }))
          throw error
        }
        console.log('[seo-articles] delete OK, id:', id)
        return Response.json({ ok: true }, { headers: corsHeaders })
      }

      default:
        return errorResponse('unknown_action', 400)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[seo-articles] unhandled error:', message, err instanceof Error ? err.stack : '')
    return errorResponse(message, 500)
  }
})
