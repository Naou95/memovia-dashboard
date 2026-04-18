/**
 * Shared framer-motion animation presets — MEMOVIA dashboard.
 * Single source of truth for all spring physics, easing curves,
 * and variant definitions used across every page and component.
 */

// ── Spring physics ────────────────────────────────────────────────────────────

export const spring = {
  /** Quick, decisive — nav pill, hover lifts, KPI cards */
  snappy: { type: 'spring' as const, duration: 0.4, bounce: 0.08 },
  /** Natural, relaxed — page sections, modals */
  gentle: { type: 'spring' as const, duration: 0.55, bounce: 0.04 },
  /** Crisp slide — sidebar active indicator */
  slide: { type: 'spring' as const, stiffness: 400, damping: 32 },
}

// ── Easing curves ─────────────────────────────────────────────────────────────

export const ease = {
  /** Strong ease-out — entrances feel responsive */
  out: [0.25, 1, 0.5, 1] as [number, number, number, number],
  /** Expo ease-out — count-up numbers, decisive pop */
  outExpo: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** Ease-in-out — exits, on-screen morphs */
  inOut: [0.77, 0, 0.175, 1] as [number, number, number, number],
}

// ── Page-level transition (AppLayout AnimatePresence) ─────────────────────────

export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: ease.out },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.12, ease: ease.inOut },
  },
}

// ── Stagger orchestration ─────────────────────────────────────────────────────

/** Container — staggers each `staggerItem` child */
export const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.02,
    },
  },
}

/** Child of staggerContainer — slides up and fades in */
export const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: spring.snappy,
  },
}

/** Faster stagger for dense KPI card grids */
export const staggerCard = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: spring.snappy,
  },
}

/** Inner grid stagger — tighter delay for card rows */
export const cardGridContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0,
    },
  },
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

/** Stagger container for sidebar nav groups */
export const sidebarContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.06,
    },
  },
}

/** Each nav item slides in from the left on mount */
export const sidebarItem = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: spring.snappy,
  },
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Simple opacity fade — for sections without y-movement */
export const fadeIn = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.3, ease: ease.out },
  },
}
