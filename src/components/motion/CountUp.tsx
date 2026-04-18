import { useEffect, useRef } from 'react'
import { animate } from 'framer-motion'
import { ease } from '@/lib/motion'

interface CountUpProps {
  to: number
  formatter?: (n: number) => string
  className?: string
  duration?: number
}

const defaultFormatter = (n: number) => n.toLocaleString('fr-FR')

/**
 * Animates a number from 0 → `to` using an expo ease-out curve.
 * Restarts whenever `to` changes. Uses a DOM ref to avoid React
 * state re-renders during the animation loop (60fps safe).
 */
export function CountUp({
  to,
  formatter = defaultFormatter,
  className,
  duration = 1.1,
}: CountUpProps) {
  const spanRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = spanRef.current
    if (!el) return

    const controls = animate(0, to, {
      duration,
      ease: ease.outExpo,
      onUpdate: (latest) => {
        el.textContent = formatter(Math.round(latest))
      },
    })

    return () => controls.stop()
  }, [to]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span ref={spanRef} className={className}>
      {formatter(0)}
    </span>
  )
}
