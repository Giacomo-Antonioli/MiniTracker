import { totalModels } from '../collection/ownedUnit'
import { isGone } from '../collection/pipeline'
import type { OwnedUnit, Pipeline, StageId } from '../collection/types'
import type { ArmyList } from './types'

export type OwnState = 'owned' | 'partial' | 'missing'

export interface EntryOwnership {
  state: OwnState
  have: number
  need: number
  /** Collection units that supply the models, in order. */
  from: { unitId: string; models: number }[]
  /** Of `have`, models at or past the painted stage (only when a pipeline is given). */
  painted: number
}

export interface ListOwnership {
  byEntry: Map<string, EntryOwnership>
  /** True when every entry is owned. */
  complete: boolean
  missingModels: number
  /** Owned models in the list not painted yet (only when a pipeline is given). */
  unpaintedModels: number
}

/**
 * Compares a list with the collection. Worked out each time, never stored.
 * Collection units count in every list, but inside one list each model is used once.
 * Linked entries use their unit first; then entries take the remaining models of the same datasheet, in list order.
 * With a pipeline, painted models (at or past `paintedStage`) are used first, so progress reads as "what's ready".
 */
export function listOwnership(l: ArmyList, units: OwnedUnit[], pipeline?: Pipeline, paintedStage: StageId = 'painted'): ListOwnership {
  const live = units.filter((u) => !isGone(u.lifecycle))
  const byId = new Map(live.map((u) => [u.id, u]))
  const target = pipeline ? Math.max(0, pipeline.stages.findIndex((s) => s.id === paintedStage)) : 0
  const paintedOf = (u: OwnedUnit) =>
    pipeline ? u.groups.filter((g) => pipeline.stages.findIndex((s) => s.id === g.status) >= target).reduce((n, g) => n + g.count, 0) : 0

  const left = new Map(live.map((u) => [u.id, totalModels(u)]))
  const paintedLeft = new Map(live.map((u) => [u.id, paintedOf(u)]))
  const linkedTo = new Map<string, string>()
  for (const e of l.entries) {
    const u = e.ownedUnitId ? byId.get(e.ownedUnitId) : undefined
    if (u && u.datasheetId === e.datasheetId && ![...linkedTo.values()].includes(u.id)) linkedTo.set(e.id, u.id)
  }
  const linkedUnits = new Set(linkedTo.values())

  const take = (unitId: string, want: number, from: EntryOwnership['from']) => {
    const n = Math.min(want, left.get(unitId) ?? 0)
    if (n <= 0) return { n: 0, painted: 0 }
    left.set(unitId, left.get(unitId)! - n)
    const p = Math.min(n, paintedLeft.get(unitId)!)
    paintedLeft.set(unitId, paintedLeft.get(unitId)! - p)
    from.push({ unitId, models: n })
    return { n, painted: p }
  }

  const byEntry = new Map<string, EntryOwnership>()
  // Linked units first for every entry, so a later entry can't take a unit linked further down.
  const partial = new Map<string, { have: number; painted: number; from: EntryOwnership['from'] }>()
  for (const e of l.entries) {
    const from: EntryOwnership['from'] = []
    const u = linkedTo.get(e.id)
    const r = u ? take(u, e.models, from) : { n: 0, painted: 0 }
    partial.set(e.id, { have: r.n, painted: r.painted, from })
  }
  for (const e of l.entries) {
    const cur = partial.get(e.id)!
    // Then unlinked units of the same datasheet, a linked unit that is too small is topped up the same way.
    for (const u of live) {
      if (cur.have >= e.models) break
      if (u.datasheetId !== e.datasheetId || linkedUnits.has(u.id)) continue
      const r = take(u.id, e.models - cur.have, cur.from)
      cur.have += r.n
      cur.painted += r.painted
    }
    byEntry.set(e.id, { need: e.models, have: cur.have, from: cur.from, painted: cur.painted, state: cur.have >= e.models ? 'owned' : cur.have > 0 ? 'partial' : 'missing' })
  }

  let missingModels = 0
  let unpaintedModels = 0
  for (const o of byEntry.values()) {
    missingModels += o.need - o.have
    unpaintedModels += o.have - o.painted
  }
  return { byEntry, complete: missingModels === 0, missingModels, unpaintedModels: pipeline ? unpaintedModels : 0 }
}
