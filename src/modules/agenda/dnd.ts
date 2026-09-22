// Règles du glisser-déposer de l'agenda, sans React : où un bloc atterrit, et ce qui est refusé.
// Testé par src/test/AgendaDnd.test.ts.

import { DAY_START_MIN, clampStart, snap } from '@/lib/agenda'

export type DragKind = 'task' | 'rdv' | 'session'

/** Ce qu'on déplace. `id` : l'id de la tâche ou du RDV ; pour une séance, son jour. */
export interface DragData {
  kind: DragKind
  id: string
  durMin: number
  title: string
}

/** Où on le lâche : une colonne de jour (avec des heures) ou la case « journée » (sans heure). */
export interface DropData {
  zone: 'col' | 'allday'
  day: string
  /** Hauteur d'une heure dans cette colonne, en pixels. */
  hourPx: number
}

export type DropResult =
  | { ok: true; day: string; startMin: number | null }
  | { ok: false; reason: string }

/**
 * @param draggedTop haut du bloc déplacé, en pixels écran
 * @param zoneTop haut de la zone de dépôt, en pixels écran
 */
export function dropTarget(drag: DragData, drop: DropData, draggedTop: number, zoneTop: number): DropResult {
  if (drop.zone === 'allday') {
    // Seule une tâche peut ne pas avoir d'heure : un RDV ou une séance d'appels en a forcément une.
    if (drag.kind !== 'task') return { ok: false, reason: drag.kind === 'rdv' ? 'Un RDV garde une heure.' : 'Une séance d’appels garde une heure.' }
    return { ok: true, day: drop.day, startMin: null }
  }
  const raw = DAY_START_MIN + ((draggedTop - zoneTop) / drop.hourPx) * 60
  return { ok: true, day: drop.day, startMin: clampStart(snap(raw), drag.durMin) }
}

export const dragId = (kind: DragKind, id: string) => `${kind}:${id}`
export const dropId = (zone: DropData['zone'], day: string) => `${zone}:${day}`

/** Relit une zone de dépôt depuis ses attributs (`data-drop-id="col:2026-09-16"`, `data-hour-px="64"`). */
export function readDropZone(el: Element): DropData | null {
  const [zone, day] = (el.getAttribute('data-drop-id') ?? '').split(':')
  const hourPx = Number(el.getAttribute('data-hour-px'))
  if ((zone !== 'col' && zone !== 'allday') || !/^\d{4}-\d{2}-\d{2}$/.test(day ?? '') || !(hourPx > 0)) return null
  return { zone, day, hourPx }
}

/**
 * La zone sous le pointeur, et son haut mesuré à l'instant. On vise avec le pointeur, comme Outlook :
 * la surface du fantôme (plus large qu'une colonne) désignait la colonne d'à côté, et les positions
 * mesurées au début du geste devenaient fausses dès que la grille défilait toute seule.
 */
export function zoneAt(x: number, y: number, doc: Document = document): { data: DropData; top: number } | null {
  if (typeof doc.elementsFromPoint !== 'function') return null
  for (const el of doc.elementsFromPoint(x, y)) {
    const zone = el.closest('[data-drop-id]')
    const data = zone ? readDropZone(zone) : null
    if (zone && data) return { data, top: zone.getBoundingClientRect().top }
  }
  return null
}

/** Les coordonnées écran d'un événement de pointeur, de souris ou de toucher. */
export function pointerOf(ev: Event | null): { x: number; y: number } | null {
  if (!ev) return null
  if ('clientX' in ev && typeof ev.clientX === 'number') return { x: ev.clientX, y: (ev as MouseEvent).clientY }
  const t = (ev as TouchEvent).touches?.[0] ?? (ev as TouchEvent).changedTouches?.[0]
  return t ? { x: t.clientX, y: t.clientY } : null
}
