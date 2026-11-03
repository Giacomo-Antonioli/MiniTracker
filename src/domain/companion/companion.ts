import type { OwnedUnit } from '../collection/types'
import { techniqueFor } from '../guides/techniques'
import { paintingOrder } from '../guides/prepare'
import type { PaintScheme } from '../schemes/types'

/** Painter / builder companions (#89 follow-up): checklist ticks per unit, saved in the backup. */
export type Ticks = Record<string, string[]>
export type CompanionMode = 'paint' | 'build'

export interface CheckItem {
  key: string
  label: string
  detail?: string
  paintIds?: string[]
  tip?: string
  area?: string
}

export function toggleTick(t: Ticks, unitId: string, key: string): Ticks {
  const on = t[unitId] ?? []
  const next = on.includes(key) ? on.filter((k) => k !== key) : [...on, key]
  const out = { ...t }
  if (next.length) out[unitId] = next
  else delete out[unitId]
  return out
}

export const clearTicks = (t: Ticks, unitId: string, prefix: string): Ticks => {
  const next = (t[unitId] ?? []).filter((k) => !k.startsWith(prefix))
  const out = { ...t }
  if (next.length) out[unitId] = next
  else delete out[unitId]
  return out
}

export function parseTicks(x: unknown): Ticks {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {}
  return Object.fromEntries(Object.entries(x as Record<string, unknown>).filter((e): e is [string, string[]] => Array.isArray(e[1]) && e[1].every((k) => typeof k === 'string')))
}

/** Scheme steps in painting order, with the first tip of the step's technique from the Guides. */
export function paintChecklist(s: PaintScheme): CheckItem[] {
  return paintingOrder(s.sections).flatMap(({ section }) =>
    section.steps.map((st) => {
      const g = techniqueFor(st.technique)
      return {
        key: `paint:${st.id}`,
        area: section.area,
        label: st.technique || 'Step',
        detail: [st.thinning, st.tool, st.note].filter(Boolean).join(' · ') || undefined,
        paintIds: st.paints.map((p) => p.paintId),
        tip: g?.detail?.tips[0] ?? g?.what,
      }
    }),
  )
}

/** What to assemble: each group's wargear and magnet slots. */
export function buildChecklist(u: OwnedUnit): CheckItem[] {
  const many = u.groups.length > 1
  return u.groups.flatMap((g) => {
    const who = many ? `${g.count}× ` : ''
    return [
      ...g.loadout.map((w) => ({ key: `wargear:${g.id}:${w}`, label: `${who}${w}` })),
      ...g.magnetised.map((m) => ({ key: `magnet:${g.id}:${m.slot}`, label: `🧲 ${who}${m.slot}`, detail: m.optionIds.join(' | ') })),
    ]
  })
}
