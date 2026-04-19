import { Calendar, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface Props {
  googleConfigured: boolean
  canConnect: boolean
  onConnect: () => Promise<void>
}

export function CalendarEmptyState({ googleConfigured, canConnect, onConnect }: Props) {
  const [loading, setLoading] = useState(false)

  if (googleConfigured) return null

  async function handleConnect() {
    setLoading(true)
    try {
      await onConnect()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connexion impossible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-[var(--border-color)] bg-white py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--memovia-violet-light)]">
        <Calendar className="h-7 w-7 text-[var(--memovia-violet)]" />
      </div>

      <div>
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
          Google Calendar non connecté
        </h2>
        <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
          Connectez votre Google Calendar pour afficher vos événements et créer des réunions Meet.
        </p>
      </div>

      {canConnect && (
        <button
          onClick={handleConnect}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-[var(--memovia-violet)] px-5 py-2.5 text-[13px] font-medium text-white hover:bg-[var(--memovia-violet-hover)] disabled:opacity-60 transition-colors"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          {loading ? 'Connexion…' : 'Connecter Google Calendar'}
        </button>
      )}

      {canConnect && (
        <details className="w-full max-w-md px-4">
          <summary className="cursor-pointer text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] select-none">
            Variables d'environnement requises (développeur)
          </summary>
          <div className="mt-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4 text-left text-[11px] text-[var(--text-secondary)] space-y-2">
            <ul className="space-y-1 font-mono list-disc list-inside">
              <li>GOOGLE_CLIENT_ID</li>
              <li>GOOGLE_CLIENT_SECRET</li>
              <li>APP_URL</li>
            </ul>
            <p className="pt-1">
              Callback à enregistrer dans Google Cloud Console :
            </p>
            <code className="block rounded bg-white px-2 py-1 text-[10px] border border-[var(--border-color)] break-all">
              {import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-oauth-callback
            </code>
          </div>
        </details>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
