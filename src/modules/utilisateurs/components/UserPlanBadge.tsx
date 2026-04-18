import type { MemoviaUserPlan } from '@/types/users'
import { PLAN_LABELS } from '@/types/users'

interface UserPlanBadgeProps {
  plan: MemoviaUserPlan
}

const PLAN_STYLES: Record<MemoviaUserPlan, { bg: string; color: string }> = {
  free: {
    bg: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
  },
  pro: {
    bg: 'color-mix(in oklab, var(--memovia-cyan) 18%, var(--bg-primary))',
    color: 'color-mix(in oklab, var(--memovia-cyan) 70%, #000)',
  },
  b2b: {
    bg: 'var(--accent-purple-bg)',
    color: 'var(--memovia-violet)',
  },
}

export function UserPlanBadge({ plan }: UserPlanBadgeProps) {
  const styles = PLAN_STYLES[plan]
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        backgroundColor: styles.bg,
        color: styles.color,
        border: '1px solid currentColor',
        opacity: plan === 'free' ? 0.85 : 1,
      }}
    >
      {PLAN_LABELS[plan]}
    </span>
  )
}
