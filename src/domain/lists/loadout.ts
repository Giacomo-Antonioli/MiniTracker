import type { Datasheet, ModelType } from '../catalogue/types'
import type { OwnedUnit } from '../collection/types'
import type { ListEntry, LoadoutRow } from './types'

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()

/** Default picks for one model: each choice's default, or its first options when it must be taken. */
export function defaultPicks(m: ModelType): string[] {
  return m.choices.flatMap((c) => (c.defaultId ? [c.defaultId] : c.options.slice(0, c.min).map((o) => o.id)))
}

/**
 * The unit as it comes "out of the box": each model type's minimum, then the rest of the models as the type with
 * the most room (usually the plain trooper), each with default picks.
 */
export function defaultLoadout(d: Datasheet, models: number): LoadoutRow[] {
  const types = d.models ?? []
  const rows = types.filter((m) => m.min > 0).map((m) => ({ modelId: m.id, count: m.min, picks: defaultPicks(m) }))
  let left = models - rows.reduce((n, r) => n + r.count, 0)
  for (const m of [...types].sort((a, b) => b.max - b.min - (a.max - a.min) || a.name.length - b.name.length)) {
    if (left <= 0) break
    const row = rows.find((r) => r.modelId === m.id)
    const room = m.max - (row?.count ?? 0)
    const add = Math.min(room, left)
    if (add <= 0) continue
    if (row) row.count += add
    else rows.push({ modelId: m.id, count: add, picks: defaultPicks(m) })
    left -= add
  }
  return rows
}

/**
 * Your models' loadout (backlog groups: count + wargear names) as list rows: each group goes to the model type whose
 * wargear matches its names best, and picks the options it names. Undefined when nothing matches.
 */
export function loadoutFromModels(d: Datasheet, units: OwnedUnit[]): LoadoutRow[] | undefined {
  const types = d.models ?? []
  if (!types.length) return undefined
  const rows: LoadoutRow[] = []
  for (const g of units.flatMap((u) => u.groups)) {
    const names = new Set(g.loadout.map(norm))
    if (!names.size) continue
    const score = (m: ModelType) =>
      m.fixed.filter((f) => names.has(norm(f))).length * 2 + m.choices.flatMap((c) => c.options).filter((o) => names.has(norm(o.name))).length + (names.has(norm(m.name)) ? 5 : 0)
    const best = [...types].sort((a, b) => score(b) - score(a))[0]
    if (score(best) <= 0) continue
    const picks = best.choices.flatMap((c) => {
      const named = c.options.filter((o) => names.has(norm(o.name))).map((o) => o.id)
      return named.length ? named.slice(0, c.max) : c.defaultId ? [c.defaultId] : c.options.slice(0, c.min).map((o) => o.id)
    })
    const same = rows.find((r) => r.modelId === best.id && r.picks.join() === picks.join())
    if (same) same.count += g.count
    else rows.push({ modelId: best.id, count: g.count, picks })
  }
  return rows.length ? rows : undefined
}

export type LoadoutSource = 'list' | 'models' | 'default'

/** The loadout shown and checked for a list unit: the list's own, else your linked models', else the default. */
export function effectiveLoadout(e: ListEntry, d: Datasheet, linked: OwnedUnit[]): { rows: LoadoutRow[]; source: LoadoutSource } {
  if (e.loadout?.length) return { rows: e.loadout, source: 'list' }
  const mine = linked.length ? loadoutFromModels(d, linked) : undefined
  if (mine && mine.reduce((n, r) => n + r.count, 0) === e.models) return { rows: mine, source: 'models' }
  return { rows: defaultLoadout(d, e.models), source: 'default' }
}

/** Problems with a loadout: total, model type limits, and each choice's min/max. */
export function loadoutProblems(d: Datasheet, models: number, rows: LoadoutRow[]): string[] {
  const types = new Map((d.models ?? []).map((m) => [m.id, m]))
  if (!types.size) return []
  const out: string[] = []
  const total = rows.reduce((n, r) => n + r.count, 0)
  if (total !== models) out.push(`${d.name}: loadout has ${total} models, the unit has ${models}`)
  const perType = new Map<string, number>()
  for (const r of rows) perType.set(r.modelId, (perType.get(r.modelId) ?? 0) + r.count)
  for (const m of types.values()) {
    const n = perType.get(m.id) ?? 0
    if (n < m.min || n > m.max) out.push(`${d.name}: ${n} × ${m.name}, allowed ${m.min === m.max ? m.min : `${m.min}–${m.max}`}`)
  }
  for (const r of rows) {
    const m = types.get(r.modelId)
    if (!m) {
      out.push(`${d.name}: a model type is not in the catalogue`)
      continue
    }
    for (const c of m.choices) {
      const picked = r.picks.filter((p) => c.options.some((o) => o.id === p))
      if (picked.length < c.min || picked.length > c.max) out.push(`${d.name}: ${m.name} must take ${c.min === c.max ? c.min : `${c.min}–${c.max}`} of ${c.name}`)
      for (const o of c.options) {
        const k = picked.filter((p) => p === o.id).length
        if (k > o.max) out.push(`${d.name}: ${m.name} has ${k} × ${o.name}, max ${o.max}`)
      }
    }
  }
  return [...new Set(out)]
}
