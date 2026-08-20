const TELEGRAM_API = 'https://api.telegram.org'

/** Échappe une valeur qui vient de la base avant de l'insérer dans un message Markdown.
 *
 * Indispensable : en Markdown « legacy », Telegram traite `_` `*` `[` et `` ` `` comme des
 * marqueurs. Un statut de lead qui vaut `en_discussion` produisait `_(en_discussion)_`, soit
 * trois underscores, donc un balisage impair : l'API répondait 400 et TOUT le message partait
 * en texte brut, étoiles comprises. Vu en prod le 15/08/2026 sur le briefing du matin.
 *
 * À appliquer à toute valeur dynamique (nom de lead, titre de tâche, email), jamais au balisage
 * qu'on écrit soi-même. */
export function echapperMarkdown(valeur: string): string {
  return valeur.replace(/([_*[\]`])/g, '\\$1')
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not configured')

  const truncated = text.length > 4000 ? text.slice(0, 3997) + '…' : text

  const resp = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: truncated, parse_mode: 'Markdown' }),
  })

  if (!resp.ok) {
    // Repli en texte brut : le message part quand même, c'est voulu — mieux vaut un briefing
    // moche qu'aucun briefing. ⚠️ Mais ce repli ne doit PAS être silencieux : tant qu'il l'était,
    // le message arrivait avec ses `*` et ses `_` en clair et la fonction renvoyait `ok: true`,
    // donc rien ne signalait la panne de formatage. Même piège que les crons qui rapportaient
    // « succeeded » sur un appel HTTP jamais abouti. On log AVANT de réessayer.
    const causeBrute = await resp.text()
    console.error(
      `[telegram] Markdown REFUSÉ (${resp.status}) : ${causeBrute.slice(0, 300)} — ` +
      `repli en texte brut, le formatage est perdu. Cherche un _ ou un * non échappé ` +
      `dans une valeur dynamique (cf. echapperMarkdown).`,
    )

    const retry = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: truncated }),
    })
    if (!retry.ok) {
      const body = await retry.text()
      throw new Error(`Telegram API error ${retry.status}: ${body.slice(0, 200)}`)
    }
  }
}
