import { AlertCircle, X } from 'lucide-react'
import { useState } from 'react'

interface Props {
  onConnect: () => Promise<void>
}

export function MicrosoftBanner({ onConnect }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)

  if (dismissed) return null

  async function handleConnect() {
    setLoading(true)
    try {
      await onConnect()
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
      <p className="flex-1 text-[13px] text-amber-800">
        <span className="font-semibold">Calendrier Emir non connecté.</span>
        {' '}Seul l'agenda de Naoufel est affiché.{' '}
        <button
          onClick={handleConnect}
          disabled={loading}
          className="underline underline-offset-2 hover:text-amber-900 font-medium disabled:opacity-60"
        >
          {loading ? 'Connexion…' : 'Connecter Outlook'}
        </button>
        {' '}(peut nécessiter une autorisation IT)
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 text-amber-600 hover:bg-amber-100 hover:text-amber-800 transition-colors"
        aria-label="Fermer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
