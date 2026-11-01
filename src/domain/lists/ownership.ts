import { totalModels } from '../collection/ownedUnit'
import { isGone } from '../collection/pipeline'
import type { OwnedUnit } from '../collection/types'
import type { ArmyList } from './types'

export type OwnState = 'owned' | 'partial' | 'missing'

export interface EntryOwnership {
  state: OwnState
  have: number
  need: number
}

export interface ListOwnership {
  byEntry: Map<string, EntryOwnership>
  /** True when every entry is owned. */
  complete: boolean
  missingModels: number
}

/**
 * Compares a list with the collection. Worked out each time, never stored.
 * Collection units count in every list, but inside one list each model is used once.
 * Linked entries use their unit first; then all entries share the remaining models of the same datasheet, in list order.
 */
export function listOwnership(l: ArmyList, units: OwnedUnit[]): ListOwnership {
  const live = units.filter((u) => !isGone(u.lifecycle))
  const byId = new Map(live.map((u) => [u.id, u]))
  const used = new Set<string>()
  const linked = new Map<string, number>()
  const result = (need: number, have: number): EntryOwnership => ({ need, have, state: have >= need ? 'owned' : have > 0 ? 'partial' : 'missing' })

  for (const e of l.entries) {
    if (!e.ownedUnitId) continue
    const u = byId.get(e.ownedUnitId)
    if (!u || used.has(u.id) || u.datasheetId !== e.datasheetId) continue
    used.add(u.id)
    linked.set(e.id, Math.min(e.models, totalModels(u)))
  }

  const pool = new Map<string, number>()
  for (const u of live) {
    if (!u.datasheetId || used.has(u.id)) continue
    pool.set(u.datasheetId, (pool.get(u.datasheetId) ?? 0) + totalModels(u))
  }
  // A linked unit that is too small is topped up from the shared models.
  const byEntry = new Map<string, EntryOwnership>()
  for (const e of l.entries) {
    const own = linked.get(e.id) ?? 0
    const left = pool.get(e.datasheetId) ?? 0
    const extra = Math.min(left, e.models - own)
    pool.set(e.datasheetId, left - extra)
    byEntry.set(e.id, result(e.models, own + extra))
  }

  let missingModels = 0
  for (const o of byEntry.values()) missingModels += o.need - o.have
  return { byEntry, complete: missingModels === 0, missingModels }
}
