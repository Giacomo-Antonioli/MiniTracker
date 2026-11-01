import { splitGroup } from './ownedUnit'
import type { Ctx, Lifecycle, OwnedUnit, Pipeline, Stage, StageId, StatusEvent } from './types'

export const DEFAULT_PIPELINE: Pipeline = {
  stages: [
    { id: 'sprue', name: 'On sprue' },
    { id: 'built', name: 'Built' },
    { id: 'primed', name: 'Primed' },
    { id: 'basecoated', name: 'Basecoated' },
    { id: 'painted', name: 'Painted' },
    { id: 'based', name: 'Based' },
    { id: 'varnished', name: 'Varnished' },
  ],
}

/** Lifecycle states whose models no longer count towards the backlog. */
const GONE: ReadonlySet<Lifecycle> = new Set(['sold', 'traded', 'gifted', 'lost'])

export function isGone(lifecycle: Lifecycle): boolean {
  return GONE.has(lifecycle)
}

export function validatePipeline(p: Pipeline): void {
  if (p.stages.length === 0) throw new Error('Pipeline needs at least one stage')
  const seen = new Set<string>()
  for (const s of p.stages) {
    if (seen.has(s.id)) throw new Error(`Duplicate stage id: ${s.id}`)
    seen.add(s.id)
  }
}

function indexOf(p: Pipeline, id: StageId): number {
  const i = p.stages.findIndex((s) => s.id === id)
  if (i < 0) throw new Error(`Unknown stage: ${id}`)
  return i
}

export function addStage(p: Pipeline, stage: Stage, afterId?: StageId): Pipeline {
  if (p.stages.some((s) => s.id === stage.id)) throw new Error(`Stage already exists: ${stage.id}`)
  const at = afterId === undefined ? p.stages.length : indexOf(p, afterId) + 1
  const stages = [...p.stages]
  stages.splice(at, 0, { ...stage })
  return { stages }
}

export function renameStage(p: Pipeline, id: StageId, name: string): Pipeline {
  indexOf(p, id)
  if (!name.trim()) throw new Error('Stage name is required')
  return { stages: p.stages.map((s) => (s.id === id ? { ...s, name: name.trim() } : s)) }
}

export function reorderStages(p: Pipeline, ids: StageId[]): Pipeline {
  const same = ids.length === p.stages.length && new Set(ids).size === ids.length && ids.every((id) => p.stages.some((s) => s.id === id))
  if (!same) throw new Error('Reorder must list the same stages exactly once')
  return { stages: ids.map((id) => p.stages[indexOf(p, id)]) }
}

/** Remove a stage, unless some unit still has models in it. */
export function removeStage(p: Pipeline, id: StageId, units: OwnedUnit[]): Pipeline {
  return removeUnusedStage(p, id, units.some((u) => u.groups.some((g) => g.status === id)) ? 1 : 0)
}

/** Remove a stage from any pipeline, unless `usedBy` items are still in it. */
export function removeUnusedStage(p: Pipeline, id: StageId, usedBy: number): Pipeline {
  indexOf(p, id)
  if (p.stages.length === 1) throw new Error('Pipeline needs at least one stage')
  if (usedBy > 0) throw new Error(`Stage "${id}" is in use`)
  return { stages: p.stages.filter((s) => s.id !== id) }
}

export interface MoveOptions {
  /** Defaults to ctx.now. */
  date?: string
  photoId?: string
  note?: string
}

/** Move models of one group to another stage and return the history event for it. */
export function moveModels(
  unit: OwnedUnit,
  groupId: string,
  count: number,
  to: StageId,
  pipeline: Pipeline,
  ctx: Ctx,
  opts: MoveOptions = {},
): { unit: OwnedUnit; event: StatusEvent } {
  const group = unit.groups.find((g) => g.id === groupId)
  if (!group) throw new Error(`Unknown group: ${groupId}`)
  const toIdx = indexOf(pipeline, to)
  if (group.status === to) throw new Error(`Models are already in stage "${to}"`)
  const date = opts.date ?? ctx.now
  if (Number.isNaN(Date.parse(date))) throw new Error(`Invalid date: ${date}`)

  // A group in a stage removed from the pipeline counts as "before everything".
  const fromIdx = pipeline.stages.findIndex((s) => s.id === group.status)
  const event: StatusEvent = {
    id: ctx.newId(),
    unitId: unit.id,
    groupId,
    from: group.status,
    to,
    count,
    date,
    direction: toIdx > fromIdx ? 'forward' : 'backward',
    note: opts.note ?? '',
    ...(opts.photoId ? { photoId: opts.photoId } : {}),
  }
  return { unit: splitGroup(unit, groupId, count, to, ctx), event }
}

/** Share of models at or past `target`, over units still in the collection. */
export function progress(units: OwnedUnit[], pipeline: Pipeline, target: StageId) {
  const t = indexOf(pipeline, target)
  let done = 0
  let total = 0
  for (const u of units) {
    if (isGone(u.lifecycle)) continue
    for (const g of u.groups) {
      total += g.count
      if (pipeline.stages.findIndex((s) => s.id === g.status) >= t) done += g.count
    }
  }
  return { done, total, ratio: total === 0 ? 0 : done / total }
}

export function setLifecycle(unit: OwnedUnit, lifecycle: Lifecycle, ctx: Pick<Ctx, 'now'>): OwnedUnit {
  return { ...unit, lifecycle, updatedAt: ctx.now }
}

export function setFlags(
  unit: OwnedUnit,
  flags: Partial<Pick<OwnedUnit, 'favourite' | 'nextUp'>>,
  ctx: Pick<Ctx, 'now'>,
): OwnedUnit {
  return { ...unit, ...flags, updatedAt: ctx.now }
}
