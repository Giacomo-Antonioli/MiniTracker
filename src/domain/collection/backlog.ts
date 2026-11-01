import { isGone, progress } from './pipeline'
import type { Lifecycle, OwnedUnit, Pipeline, Stage, StageId } from './types'

export function unitProgress(unit: OwnedUnit, pipeline: Pipeline, target: StageId = 'painted') {
  return progress([{ ...unit, lifecycle: 'active' }], pipeline, target)
}

/** Models per stage, in pipeline order, only stages with models, ignoring sold/traded/... units. */
export function stageTotals(units: OwnedUnit[], pipeline: Pipeline): { stage: Stage; count: number }[] {
  const counts = new Map<StageId, number>()
  for (const u of units) {
    if (isGone(u.lifecycle)) continue
    for (const g of u.groups) counts.set(g.status, (counts.get(g.status) ?? 0) + g.count)
  }
  return pipeline.stages.filter((s) => counts.has(s.id)).map((stage) => ({ stage, count: counts.get(stage.id)! }))
}

export interface BacklogFilter {
  text?: string
  faction?: string
  stage?: StageId
  /** 'current' = active + on-hold (default), 'all', or one lifecycle. */
  lifecycle?: 'current' | 'all' | Lifecycle
  favouritesOnly?: boolean
  nextUpOnly?: boolean
}

export function filterUnits(units: OwnedUnit[], f: BacklogFilter): OwnedUnit[] {
  const text = f.text?.trim().toLowerCase()
  const life = f.lifecycle ?? 'current'
  return units.filter((u) => {
    if (life === 'current' ? isGone(u.lifecycle) : life !== 'all' && u.lifecycle !== life) return false
    if (f.faction && u.factionName !== f.faction) return false
    if (f.stage && !u.groups.some((g) => g.status === f.stage)) return false
    if (f.favouritesOnly && !u.favourite) return false
    if (f.nextUpOnly && !u.nextUp) return false
    if (text) {
      const hay = [u.customName, u.factionName ?? '', ...u.tags].join(' ').toLowerCase()
      if (!hay.includes(text)) return false
    }
    return true
  })
}

export function factionsOf(units: OwnedUnit[]): string[] {
  return [...new Set(units.map((u) => u.factionName).filter((x): x is string => !!x))].sort()
}
