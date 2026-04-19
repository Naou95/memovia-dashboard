import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResult = await validateAuth(req)
  if (authResult instanceof Response) return authResult
  const { user } = authResult

  const token = Deno.env.get('SENTRY_AUTH_TOKEN')
  const org = Deno.env.get('SENTRY_ORG')
  const project = Deno.env.get('SENTRY_PROJECT')

  if (!token || !org || !project) {
    return errorResponse('sentry_not_configured', 500)
  }

  try {
    const sentryRes = await fetch(
      `https://sentry.io/api/0/projects/${org}/${project}/issues/?query=is:unresolved&statsPeriod=7d&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!sentryRes.ok) {
      return errorResponse(`sentry_api_error: ${sentryRes.status}`, 502)
    }

    const raw: any[] = await sentryRes.json()

    const issues = raw.map((issue) => {
      const occurrences = issue.times_seen ?? 0
      const usersAffected = issue.userCount ?? issue.users?.count ?? 0
      const level = issue.level ?? 'error'
      const isCritical = (level === 'error' || level === 'fatal') && occurrences > 5

      return {
        id: issue.id,
        title: issue.title,
        level,
        occurrences,
        usersAffected,
        firstSeen: issue.firstSeen,
        lastSeen: issue.lastSeen,
        permalink: issue.permalink,
        isCritical,
      }
    })

    const stats = {
      totalIssues: issues.length,
      totalOccurrences: issues.reduce((sum, i) => sum + i.occurrences, 0),
      usersAffected: issues.reduce((sum, i) => sum + i.usersAffected, 0),
    }

    // Fire-and-forget notifications for critical issues
    const criticalIssues = issues.filter((i) => i.isCritical)
    if (criticalIssues.length > 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      for (const issue of criticalIssues) {
        fetch(`${supabaseUrl}/functions/v1/create-notification`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user.id,
            type: 'sentry_critical',
            title: 'Bug critique détecté',
            message: `${issue.title} — ${issue.occurrences} occurrences`,
          }),
        }).catch(() => {}) // truly fire-and-forget
      }
    }

    return Response.json(
      { stats, issues, fetchedAt: new Date().toISOString() },
      { headers: corsHeaders },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return errorResponse(message, 502)
  }
})
