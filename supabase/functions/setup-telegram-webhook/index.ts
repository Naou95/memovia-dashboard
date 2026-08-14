/**
 * Edge Function : setup-telegram-webhook
 *
 * Utilitaire d'administration : (ré)enregistre l'URL du webhook Telegram auprès de l'API Bot.
 * À lancer à la main quand le webhook doit être reposé (changement d'URL, bot recréé, ou
 * `getWebhookInfo` qui montre une URL vide).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 SOURCE RESTAURÉE LE 14/08/2026. Cette fonction était déployée en prod (v17) et son code
 * n'existait dans AUCUN des cinq dépôts — `find ~/memovia -name setup-telegram-webhook` ne
 * rendait rien. Le code ci-dessous vient de la version déployée, récupérée via l'API Supabase,
 * puis corrigé sur deux points. Trouvée par revue adversariale.
 *
 * DEUX DÉFAUTS DANS LA VERSION DÉPLOYÉE :
 *
 * 1. `Deno.serve(async () => {` — la requête n'était jamais regardée, et la fonction tourne en
 *    `verify_jwt = false`. N'importe qui connaissant l'URL pouvait la déclencher.
 *
 * 2. 🔑 PIRE QUE LE TROU DE SÉCURITÉ : elle appelait `setWebhook` SANS `secret_token`. Or
 *    l'API Telegram **réinitialise les paramètres non fournis**. Chaque appel effaçait donc le
 *    secret du webhook — et `telegram-webhook/index.ts:10-15` refuse toute mise à jour dont le
 *    header `X-Telegram-Bot-Api-Secret-Token` ne correspond pas à `TELEGRAM_WEBHOOK_SECRET`.
 *
 *    Conséquence : un seul appel de cette fonction TUAIT le copilote Telegram, et il mourait
 *    **en silence** — `telegram-webhook` répond `200 'ok'` en jetant le message, exactement le
 *    mode de panne qui a caché 117 échecs de cron pendant quatre mois.
 *
 * Les deux sont corrigés ici : porte service_role, et `secret_token` transmis à `setWebhook`.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */

import { timingSafeEqual } from '../_shared/timingSafeEqual.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  // Utilitaire d'admin : rien d'autre que le service_role n'a de raison de l'appeler.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!token || !serviceRoleKey || !timingSafeEqual(token, serviceRoleKey)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!botToken) return Response.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 })

  // Sans ce secret on refuse d'agir : reposer le webhook sans lui reviendrait à effacer celui en
  // place et à condamner `telegram-webhook` à jeter toutes les mises à jour. Échouer bruyamment
  // vaut mieux que casser le bot en rendant 200.
  const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  if (!webhookSecret) {
    return Response.json(
      { error: 'TELEGRAM_WEBHOOK_SECRET not set — reposer le webhook sans lui casserait telegram-webhook' },
      { status: 500 },
    )
  }

  const webhookUrl = 'https://mzjzwffpqubpruyaaxew.supabase.co/functions/v1/telegram-webhook'
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, secret_token: webhookSecret }),
  })

  const data = await resp.json()
  return Response.json(data)
})
