import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, validateAuth, errorResponse } from '../_shared/auth.ts'

function formatDateFr(isoDate: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(new Date(isoDate))
}

function levelEmoji(level: string): string {
  if (level === 'fatal') return '🔴'
  if (level === 'error') return '🟠'
  if (level === 'warning') return '🟡'
  return '🔵'
}

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
      `https://sentry.io/api/0/projects/${org}/${project}/issues/?query=is:unresolved&statsPeriod=14d&limit=50`,
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
      const isCritical = level === 'error' || level === 'fatal'

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Tout bug apparu dans les 24 dernières heures → notif Telegram
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentIssues = issues.filter((i) => new Date(i.firstSeen) >= cutoff)

    if (recentIssues.length > 0) {
      const supabase = createClient(supabaseUrl, serviceRoleKey)

      const ids = recentIssues.map((i) => i.id)
      const { data: alreadyNotified } = await supabase
        .from('sentry_notified_issues')
        .select('issue_id')
        .in('issue_id', ids)

      const notifiedSet = new Set((alreadyNotified ?? []).map((r: any) => r.issue_id))
      const toNotify = recentIssues.filter((i) => !notifiedSet.has(i.id))

      if (toNotify.length > 0) {
        const chatIds = [
          Deno.env.get('TELEGRAM_CHAT_ID_NAOUFEL'),
          Deno.env.get('TELEGRAM_CHAT_ID_EMIR'),
        ].filter(Boolean) as string[]

        for (const issue of toNotify) {
          const emoji = levelEmoji(issue.level)
          const dateFr = formatDateFr(issue.firstSeen)
          const message = [
            `${emoji} Nouveau bug sur app.memovia.io`,
            '',
            `Niveau : ${issue.level}`,
            issue.title,
            `📊 ${issue.occurrences} occurrences · ${issue.usersAffected} utilisateurs affectés`,
            `🕐 Détecté : ${dateFr}`,
            `🔗 ${issue.permalink}`,
          ].join('\n')

          for (const chatId of chatIds) {
            fetch(`${supabaseUrl}/functions/v1/send-telegram`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ chat_id: chatId, message }),
            }).catch(() => {})
          }
        }

        // Enregistrer les issues notifiées pour éviter les doublons
        await supabase
          .from('sentry_notified_issues')
          .insert(toNotify.map((i) => ({ issue_id: i.id })))
      }

      // Notifications in-app pour les issues récentes
      for (const issue of recentIssues) {
        fetch(`${supabaseUrl}/functions/v1/create-notification`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user.id,
            type: 'sentry_critical',
            title: 'Nouveau bug détecté',
            message: `${issue.title} — ${issue.occurrences} occurrences`,
          }),
        }).catch(() => {})
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
