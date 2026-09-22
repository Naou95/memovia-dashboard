import { describe, it, expect } from 'vitest'
import { dropTarget, pointerOf, readDropZone, zoneAt, type DragData, type DropData } from '@/modules/agenda/dnd'

const task: DragData = { kind: 'task', id: 't1', durMin: 30, title: 'Tâche' }
const rdv: DragData = { kind: 'rdv', id: 'r1', durMin: 45, title: 'Visio' }
const session: DragData = { kind: 'session', id: '2026-09-14', durMin: 150, title: 'Séance d’appels' }
const col = (day: string, hourPx = 64): DropData => ({ zone: 'col', day, hourPx })
const allday = (day: string): DropData => ({ zone: 'allday', day, hourPx: 64 })

describe('dropTarget', () => {
  it('lit l’heure à la position du bloc dans la colonne (64 px par heure, grille dès 8h)', () => {
    // 128 px sous le haut de la colonne = 2 h après 8h = 10:00
    expect(dropTarget(task, col('2026-09-16'), 300 + 128, 300)).toEqual({ ok: true, day: '2026-09-16', startMin: 600 })
  })

  it('aligne sur le quart d’heure le plus proche', () => {
    expect(dropTarget(task, col('2026-09-16'), 300 + 136, 300)).toEqual({ ok: true, day: '2026-09-16', startMin: 615 }) // 10:07:30 → 10:15
    expect(dropTarget(task, col('2026-09-16'), 300 + 133, 300)).toEqual({ ok: true, day: '2026-09-16', startMin: 600 }) // 10:04 → 10:00
  })

  it('fonctionne aussi en vue jour (156 px par heure)', () => {
    expect(dropTarget(task, col('2026-09-14', 156), 100 + 156 * 1.5, 100)).toEqual({ ok: true, day: '2026-09-14', startMin: 570 })
  })

  it('garde le bloc dans la journée, selon sa durée', () => {
    expect(dropTarget(task, col('2026-09-16'), 0, 300)).toMatchObject({ startMin: 480 }) // au-dessus de 8h → 8h
    expect(dropTarget(session, col('2026-09-16'), 300 + 64 * 9.5, 300)).toMatchObject({ startMin: 1080 - 150 }) // 2h30 : au plus tard 15:30
  })

  it('une tâche lâchée dans « journée » perd son heure', () => {
    expect(dropTarget(task, allday('2026-09-17'), 40, 10)).toEqual({ ok: true, day: '2026-09-17', startMin: null })
  })

  it('refuse un RDV ou une séance sans heure', () => {
    expect(dropTarget(rdv, allday('2026-09-17'), 40, 10)).toEqual({ ok: false, reason: 'Un RDV garde une heure.' })
    expect(dropTarget(session, allday('2026-09-17'), 40, 10)).toMatchObject({ ok: false })
  })
})

function zoneEl(id: string, hourPx: string, top = 0): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-drop-id', id)
  el.setAttribute('data-hour-px', hourPx)
  el.getBoundingClientRect = () => ({ top, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) })
  return el
}

describe('readDropZone', () => {
  it('relit la zone depuis ses attributs', () => {
    expect(readDropZone(zoneEl('col:2026-09-16', '64'))).toEqual({ zone: 'col', day: '2026-09-16', hourPx: 64 })
    expect(readDropZone(zoneEl('allday:2026-09-18', '156'))).toEqual({ zone: 'allday', day: '2026-09-18', hourPx: 156 })
  })

  it('ignore un attribut mal formé plutôt que de viser une date fausse', () => {
    expect(readDropZone(zoneEl('panneau:2026-09-16', '64'))).toBeNull()
    expect(readDropZone(zoneEl('col:16/09', '64'))).toBeNull()
    expect(readDropZone(zoneEl('col:2026-09-16', ''))).toBeNull()
  })
})

describe('zoneAt', () => {
  it('prend la zone qui contient l’élément sous le pointeur, mesurée à l’instant', () => {
    const col = zoneEl('col:2026-09-16', '64', 212)
    const block = document.createElement('div')
    col.appendChild(block)
    const overlay = document.createElement('div')
    const doc = { elementsFromPoint: () => [overlay, block, col] } as unknown as Document
    expect(zoneAt(10, 20, doc)).toEqual({ data: { zone: 'col', day: '2026-09-16', hourPx: 64 }, top: 212 })
  })

  it('rien sous le pointeur (le panneau, l’en-tête) : pas de cible', () => {
    const doc = { elementsFromPoint: () => [document.createElement('aside')] } as unknown as Document
    expect(zoneAt(10, 20, doc)).toBeNull()
    expect(zoneAt(10, 20, {} as Document)).toBeNull()
  })
})

describe('pointerOf', () => {
  it('lit la souris comme le doigt', () => {
    expect(pointerOf(new MouseEvent('mousedown', { clientX: 12, clientY: 34 }))).toEqual({ x: 12, y: 34 })
    expect(pointerOf({ touches: [{ clientX: 5, clientY: 6 }] } as unknown as Event)).toEqual({ x: 5, y: 6 })
    expect(pointerOf(null)).toBeNull()
  })
})
