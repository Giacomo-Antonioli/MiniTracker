import { isGone, progress, WISHLISTED } from './pipeline'
import type { OwnedUnit, Pipeline, StageId } from './types'

/** Backlog entries of the same datasheet and faction, shown as one summary row that expands. */
export interface UnitGroup {
  key: string
  name: string
  factionName?: string
  units: OwnedUnit[]
  /** Owned models (Wishlisted not included) of entries still in the collection. */
  models: number
  wishlisted: number
  /** Models per stage, in pipeline order, only stages with models. */
  stages: { id: StageId; name: string; count: number }[]
  painted: { done: number; total: number; ratio: number }
  schemeIds: string[]
  favourite: boolean
  nextUp: boolean
  updatedAt: string
}

const label = (u: OwnedUnit) => u.customName.trim()

export function groupUnits(units: OwnedUnit[], pipeline: Pipeline, nameOf: (datasheetId: string) => string | undefined = () => undefined): UnitGroup[] {
  const byKey = new Map<string, OwnedUnit[]>()
  for (const u of units) {
    const key = `${u.datasheetId ?? `name:${label(u).toLowerCase()}`}|${u.factionId ?? u.factionName ?? ''}`
    byKey.set(key, [...(byKey.get(key) ?? []), u])
  }
  return [...byKey].map(([key, all]) => {
    const us = [...all].sort((a, b) => label(a).localeCompare(label(b)))
    const live = us.filter((u) => !isGone(u.lifecycle))
    const counts = new Map<StageId, number>()
    for (const u of live) for (const g of u.groups) counts.set(g.status, (counts.get(g.status) ?? 0) + g.count)
    const first = all[0]
    return {
      key,
      name: (us.length > 1 && first.datasheetId && nameOf(first.datasheetId)) || label(first),
      factionName: first.factionName,
      units: us,
      models: [...counts].reduce((n, [id, c]) => n + (id === WISHLISTED ? 0 : c), 0),
      wishlisted: counts.get(WISHLISTED) ?? 0,
      stages: pipeline.stages.filter((s) => counts.has(s.id)).map((s) => ({ id: s.id, name: s.name, count: counts.get(s.id)! })),
      painted: progress(us, pipeline, 'painted'),
      schemeIds: [...new Set(us.map((u) => u.schemeId).filter((x): x is string => !!x))],
      favourite: us.some((u) => u.favourite),
      nextUp: us.some((u) => u.nextUp),
      updatedAt: us.reduce((m, u) => (u.updatedAt > m ? u.updatedAt : m), ''),
    }
  })
}

export type GroupSort = 'name' | 'faction' | 'models' | 'painted' | 'updated'

export function sortGroups(groups: UnitGroup[], by: GroupSort, desc = false): UnitGroup[] {
  const key: Record<GroupSort, (g: UnitGroup) => string | number> = {
    name: (g) => g.name.toLowerCase(),
    faction: (g) => (g.factionName ?? '').toLowerCase(),
    models: (g) => g.models + g.wishlisted,
    painted: (g) => g.painted.ratio,
    updated: (g) => g.updatedAt,
  }
  const k = key[by]
  return [...groups].sort((a, b) => {
    const [x, y] = [k(a), k(b)]
    const c = x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name)
    return desc ? -c : c
  })
}
