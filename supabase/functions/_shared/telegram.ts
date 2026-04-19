const TELEGRAM_API = 'https://api.telegram.org'

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
    // Retry without parse_mode if Markdown fails
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
