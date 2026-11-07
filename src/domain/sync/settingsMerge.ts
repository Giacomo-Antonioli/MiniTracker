/**
 * Item-by-item merge of Settings entries (#161).
 * Each entry gets a shape saying where its items are; edit times live per item path,
 * recorded on save by comparing the old and new value (stampChanges).
 */
import { mergeRecords, type MergeSummary, type Tombstone } from './merge'

export type Shape =
  | { kind: 'value' } // merged as one item
  | { kind: 'list'; key: string } // array of objects, items keyed by a field
  | { kind: 'map' } // Record<string, …>, one item per entry
  | { kind: 'struct'; fields: Record<string, Shape> }

const value: Shape = { kind: 'value' }
const list = (key = 'id'): Shape => ({ kind: 'list', key })
const map: Shape = { kind: 'map' }

/** Where the items of each Settings entry are. Entries not listed merge as one item. */
export const SETTINGS_SHAPES: Record<string, Shape> = {
  storage: {
    kind: 'struct',
    fields: { sites: list(), kinds: list(), places: list(), flow: map, codes: map, homes: map, out: map, log: list() },
  },
  games: list(),
  supplies: list(),
  tools: list(),
  purchases: list(),
  goals: list(),
  paintSessions: list(),
  paintTimers: list(),
  homeLayout: list(),
  barcodes: list('code'),
  recipeLinks: list('url'),
  companionTicks: map,
  schemeDefaults: map,
}

/** Settings entries that hold sync's own data; never stamped or merged. */
export const SYNC_KEYS = new Set(['syncStamps', 'syncTombstones', 'syncPrefs', 'syncDevices', 'deviceId', 'deviceName', 'lanCertificate'])

export type Stamps = Record<string, string>

const shapeOf = (key: string) => SETTINGS_SHAPES[key] ?? value
const path = (parts: string[]) => JSON.stringify(parts)
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

/** Flatten a value into its items: path → item. */
export function itemsOf(shape: Shape, v: unknown, prefix: string[]): Map<string, unknown> {
  const out = new Map<string, unknown>()
  if (v === undefined) return out
  if (shape.kind === 'list' && Array.isArray(v)) {
    for (const x of v) out.set(path([...prefix, String((x as Record<string, unknown>)?.[shape.key])]), x)
  } else if (shape.kind === 'map' && isObj(v)) {
    for (const [k, x] of Object.entries(v)) out.set(path([...prefix, k]), x)
  } else if (shape.kind === 'struct' && isObj(v)) {
    for (const [f, s] of Object.entries(shape.fields)) for (const [p, x] of itemsOf(s, v[f], [...prefix, f])) out.set(p, x)
  } else {
    out.set(path(prefix), v)
  }
  return out
}

/** Paths whose item was added or changed (stamped now) and paths removed (deletion markers). */
export function stampChanges(key: string, before: unknown, after: unknown): { changed: string[]; removed: string[] } {
  if (SYNC_KEYS.has(key)) return { changed: [], removed: [] }
  const a = itemsOf(shapeOf(key), before, [key])
  const b = itemsOf(shapeOf(key), after, [key])
  const changed = [...b].filter(([p, x]) => !a.has(p) || JSON.stringify(a.get(p)) !== JSON.stringify(x)).map(([p]) => p)
  const removed = [...a.keys()].filter((p) => !b.has(p))
  return { changed, removed }
}

/** Rebuild a value from its items, keeping the local order and appending new items. */
function build(shape: Shape, base: unknown, items: Map<string, unknown>, prefix: string[]): unknown {
  if (shape.kind === 'list') {
    const order = Array.isArray(base) ? base.map((x) => path([...prefix, String((x as Record<string, unknown>)?.[shape.key])])) : []
    const keys = [...order.filter((p) => items.has(p)), ...[...items.keys()].filter((p) => !order.includes(p) && isUnder(p, prefix))]
    return keys.map((p) => items.get(p))
  }
  if (shape.kind === 'map') {
    const out: Record<string, unknown> = {}
    for (const [p, x] of items) if (isUnder(p, prefix)) out[(JSON.parse(p) as string[]).at(-1)!] = x
    return out
  }
  if (shape.kind === 'struct') {
    const out: Record<string, unknown> = isObj(base) ? { ...base } : {}
    for (const [f, s] of Object.entries(shape.fields)) out[f] = build(s, isObj(base) ? base[f] : undefined, items, [...prefix, f])
    return out
  }
  return items.get(path(prefix))
}

function isUnder(p: string, prefix: string[]): boolean {
  const parts = JSON.parse(p) as string[]
  return parts.length === prefix.length + 1 && prefix.every((x, i) => parts[i] === x)
}

/** Merge one Settings entry from two devices. undefined result = entry removed. */
export function mergeSetting(
  key: string,
  local: unknown,
  remote: unknown,
  stamps: { local: Stamps; remote: Stamps },
  opts: { tombstones: Tombstone[]; applyDeletions: boolean },
): { value: unknown; summary: MergeSummary } {
  const shape = shapeOf(key)
  type Item = { id: string; x: unknown; updatedAt?: string }
  const toItems = (v: unknown, s: Stamps): Item[] => [...itemsOf(shape, v, [key])].map(([id, x]) => ({ id, x, updatedAt: s[id] }))
  const { records, summary } = mergeRecords<Item>(toItems(local, stamps.local), toItems(remote, stamps.remote), {
    tombstones: opts.tombstones.filter((t) => t.table === 'settings'),
    applyDeletions: opts.applyDeletions,
  })
  const items = new Map(records.map((r) => [r.id, r.x]))
  if (shape.kind === 'value') return { value: items.get(path([key])), summary }
  return { value: build(shape, local ?? remote, items, [key]), summary }
}
