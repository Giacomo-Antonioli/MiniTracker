import { pointsFor } from '../catalogue/points'
import type { Datasheet, Enhancement } from '../catalogue/types'
import { defaultLoadout } from './loadout'
import type { ArmyList, ListEntry } from './types'

/** Points of the options the entry's models picked (Middle-earth; other games' options cost nothing). */
export function optionPoints(d: Datasheet, e: ListEntry): number {
  const costs = new Map((d.models ?? []).flatMap((m) => m.choices.flatMap((c) => c.options)).filter((o) => o.points).map((o) => [o.id, o.points!]))
  if (!costs.size) return 0
  const rows = e.loadout?.length ? e.loadout : defaultLoadout(d, e.models)
  return rows.reduce((sum, r) => sum + r.count * r.picks.reduce((n, p) => n + (costs.get(p) ?? 0), 0), 0)
}

export interface ListPoints {
  total: number
  /** Points per entry id; undefined when the datasheet is missing or the size is not allowed. */
  byEntry: Map<string, number | undefined>
}

/**
 * Points of a list, worked out from the current catalogue: units plus their enhancements.
 * Unknown entries count 0 and are reported as undefined.
 */
export function listPoints(l: ArmyList, sheets: Map<string, Datasheet>, enhancements: Map<string, Enhancement> = new Map()): ListPoints {
  const byEntry = new Map<string, number | undefined>()
  let total = 0
  for (const e of l.entries) {
    const d = sheets.get(e.datasheetId)
    let pts: number | undefined
    try {
      pts = d && d.points.length ? pointsFor(d, e.models) + optionPoints(d, e) : undefined
    } catch {
      pts = undefined
    }
    if (pts !== undefined && e.enhancementId) pts += enhancements.get(e.enhancementId)?.points ?? 0
    byEntry.set(e.id, pts)
    total += pts ?? 0
  }
  return { total, byEntry }
}
