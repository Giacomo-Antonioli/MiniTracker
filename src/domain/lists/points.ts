import { pointsFor } from '../catalogue/points'
import type { Datasheet, Enhancement } from '../catalogue/types'
import type { ArmyList } from './types'

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
      pts = d && d.points.length ? pointsFor(d, e.models) : undefined
    } catch {
      pts = undefined
    }
    if (pts !== undefined && e.enhancementId) pts += enhancements.get(e.enhancementId)?.points ?? 0
    byEntry.set(e.id, pts)
    total += pts ?? 0
  }
  return { total, byEntry }
}
