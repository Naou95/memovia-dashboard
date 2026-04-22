import { useState, useEffect } from 'react'

function relativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins}min`
  return `il y a ${Math.floor(mins / 60)}h`
}

interface Props {
  timestamp: number | null
  className?: string
}

export function CacheFreshness({ timestamp, className = '' }: Props) {
  const [, tick] = useState(0)

  useEffect(() => {
    if (!timestamp) return
    const id = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [timestamp])

  if (!timestamp) return null

  return (
    <span className={`tabular-nums text-[var(--text-muted)] ${className}`}>
      Mis à jour {relativeTime(timestamp)}
    </span>
  )
}
