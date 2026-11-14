import { moveModels } from './pipeline'
import type { Ctx, OwnedUnit, Pipeline, StageId, StatusEvent } from './types'

/** Move every model of the unit that is at stage `from` to stage `to`; one history event per group moved. */
export function moveAllAt(unit: OwnedUnit, from: StageId, to: StageId, pipeline: Pipeline, ctx: Ctx, opts: { note?: string } = {}): { unit: OwnedUnit; events: StatusEvent[] } {
  if (from === to) throw new Error('Pick two different stages')
  let u = unit
  const events: StatusEvent[] = []
  for (let g = u.groups.find((x) => x.status === from); g; g = u.groups.find((x) => x.status === from)) {
    const r = moveModels(u, g.id, g.count, to, pipeline, ctx, opts)
    u = r.unit
    events.push(r.event)
  }
  return { unit: u, events }
}

/** Models of the unit at stage `from`. */
export const modelsAt = (unit: OwnedUnit, from: StageId) => unit.groups.filter((g) => g.status === from).reduce((n, g) => n + g.count, 0)

const clean = (tag: string) => tag.trim().replace(/^#/, '').trim()

/** The unit with the tag added or removed (case-insensitive); unchanged when there is nothing to do. */
export function withTag(unit: OwnedUnit, tag: string, on: boolean, ctx: Pick<Ctx, 'now'>): OwnedUnit {
  const t = clean(tag)
  if (!t) throw new Error('Type a tag first')
  const has = unit.tags.some((x) => x.toLowerCase() === t.toLowerCase())
  if (on === has) return unit
  return { ...unit, tags: on ? [...unit.tags, t] : unit.tags.filter((x) => x.toLowerCase() !== t.toLowerCase()), updatedAt: ctx.now }
}
