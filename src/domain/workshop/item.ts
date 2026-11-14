import type { Ctx } from '../collection/types'
import type { NewShopItem } from '../shopping/types'
import type { Pipeline } from '../collection/types'
import { DEFAULT_PIPELINES } from '../pipelines'

/** A maintenance job that repeats, e.g. "Clean the airbrush" every 7 days. */
export interface ItemTask {
  id: string
  name: string
  everyDays: number
  /** When it was last done (ISO); never done means due now. */
  lastDone?: string
}

export type ItemStatus = 'owned' | 'wishlist'
export type ItemCondition = 'good' | 'worn' | 'broken'
export type WorkshopKind = 'tool' | 'supply'

/** A tool or supply in the workshop; both have the same fields. */
export interface WorkshopItem {
  id: string
  name: string
  category: string
  brand: string
  status: ItemStatus
  condition: ItemCondition
  quantity: number
  /** Marked by hand as a liquid (its level is tracked) even if its category is not one; `false` turns a liquid category off for this item. */
  liquid?: boolean
  /** Liquid supplies: stage id in the level pipeline (Full … Empty); unset = the first stage. */
  level?: string
  /** Alert when the quantity is at or under this. */
  lowAt: number
  /** Storage place it lives in. */
  placeId?: string
  price?: number
  boughtAt?: string
  notes: string
  tasks: ItemTask[]
  /**
   * Per-copy properties when the copies differ (quantity above 1). Absent while all copies are alike. The item's own
   * level, condition, place, bought date, price and notes always mirror the `rep` copy, so everything that reads an
   * item (storage, costs, settings) keeps working on one representative copy.
   */
  copies?: ItemCopy[]
  /** Which copy stands for the whole group on the card; the first by default. */
  rep?: number
  createdAt?: string
  updatedAt: string
}

/** The properties a single copy of a tool or supply can have of its own. */
export interface ItemCopy {
  level?: string
  condition: ItemCondition
  placeId?: string
  boughtAt?: string
  price?: number
  notes: string
}

export const CONDITIONS: { id: ItemCondition; name: string }[] = [
  { id: 'good', name: 'Good' },
  { id: 'worn', name: 'Worn' },
  { id: 'broken', name: 'Broken' },
]

export interface NewItem {
  name: string
  category: string
  status?: ItemStatus
  quantity?: number
  lowAt?: number
}

export function newItem(input: NewItem, ctx: Ctx, what = 'An item'): WorkshopItem {
  const name = input.name.trim()
  if (!name) throw new Error(`${what} needs a name`)
  const status = input.status ?? 'owned'
  return {
    id: ctx.newId(), name, category: input.category, brand: '', status, condition: 'good', ...(status === 'owned' ? { boughtAt: ctx.now.slice(0, 10) } : {}),
    quantity: input.quantity ?? 1, lowAt: input.lowAt ?? 0, notes: '', tasks: [], createdAt: ctx.now, updatedAt: ctx.now,
  }
}

export const LOW_LEVEL = 'low'

/** True when the level is at or past the "running low" stage of the level pipeline. */
export function levelIsLow(level: string | undefined, levels: Pipeline = DEFAULT_PIPELINES.level): boolean {
  if (!level) return false
  const ids = levels.stages.map((s) => s.id)
  const at = ids.indexOf(level)
  const low = ids.indexOf(LOW_LEVEL)
  return at >= 0 && low >= 0 ? at >= low : level === LOW_LEVEL
}

/** Owned and at or under its alert level, or (liquids) its level is running low. */
export const isLow = (s: WorkshopItem, levels?: Pipeline) => s.status === 'owned' && (s.quantity <= s.lowAt || levelsLow(s, levels))

/** Liquid level is low: for several copies only when every copy is low (a good one is still on the shelf). */
function levelsLow(s: WorkshopItem, levels?: Pipeline): boolean {
  const copies = s.copies?.slice(0, copyCount(s))
  return copies?.length ? copies.every((c) => levelIsLow(c.level, levels)) : levelIsLow(s.level, levels)
}

export const copyCount = (t: Pick<WorkshopItem, 'quantity'>) => Math.max(1, t.quantity)
export const repIndex = (t: WorkshopItem) => Math.min(Math.max(0, Math.floor(t.rep ?? 0)), copyCount(t) - 1)
const pickCopy = (t: WorkshopItem): ItemCopy => ({ level: t.level, condition: t.condition, placeId: t.placeId, boughtAt: t.boughtAt, price: t.price, notes: t.notes })

/** The properties of copy `i` (the item's own while copies are alike). */
export const copyOf = (t: WorkshopItem, i: number): ItemCopy => t.copies?.[i] ?? pickCopy(t)

/** Item with its own level/condition/place/date/price/notes set to the representative copy's. */
function mirror(t: WorkshopItem): WorkshopItem {
  if (!t.copies?.length) return t
  const r = t.copies[repIndex(t)] ?? pickCopy(t)
  return { ...t, level: r.level, condition: r.condition, placeId: r.placeId, boughtAt: r.boughtAt, price: r.price, notes: r.notes }
}

/** Keep one entry per copy after the quantity changed: new copies start like the representative, extra ones go. */
export function fitCopies(t: WorkshopItem): WorkshopItem {
  if (!t.copies?.length) return t
  const n = copyCount(t)
  const base = copyOf(t, repIndex(t))
  const copies = Array.from({ length: n }, (_, i) => t.copies![i] ?? { ...base })
  return mirror({ ...t, copies, rep: t.rep === undefined ? undefined : Math.min(t.rep, n - 1) })
}

/**
 * Change properties of every copy (`all`) or of one copy. The first per-copy edit gives each copy its own record,
 * all alike; from then on copies can differ.
 */
export function editCopies(t: WorkshopItem, scope: 'all' | number, patch: Partial<ItemCopy>): WorkshopItem {
  if (scope === 'all' && !t.copies?.length) return { ...t, ...patch }
  const n = copyCount(t)
  const copies = Array.from({ length: n }, (_, i) => ({ ...copyOf(t, i) }))
  for (let i = 0; i < n; i++) if (scope === 'all' || scope === i) copies[i] = { ...copies[i], ...patch }
  return mirror({ ...t, copies })
}

/** Storage place of each copy, one entry per copy (undefined = no place). */
export const copyPlaces = (t: WorkshopItem): (string | undefined)[] => Array.from({ length: copyCount(t) }, (_, i) => copyOf(t, i).placeId)

/** How many copies are kept in the place. */
export const copiesAt = (t: WorkshopItem, placeId: string) => copyPlaces(t).filter((p) => p === placeId).length

/** Put the copies kept in `from` (or every copy, when `from` is left out) into the place `to`. */
export function moveCopies(t: WorkshopItem, from: string | undefined, to: string): WorkshopItem {
  if (from === undefined) return editCopies(t, 'all', { placeId: to })
  const n = copyCount(t)
  const places = copyPlaces(t)
  if (places.every((p) => p === from)) return editCopies(t, 'all', { placeId: to })
  let out = t
  for (let i = 0; i < n; i++) if (places[i] === from) out = editCopies(out, i, { placeId: to })
  return out
}

/** Make copy `i` the one that stands for the group. */
export const setRepresentative = (t: WorkshopItem, i: number): WorkshopItem => mirror({ ...t, rep: Math.min(Math.max(0, i), copyCount(t) - 1) })

/** True when this change takes the item to its alert level (or it is new and already there). */
export const becameLow = (before: WorkshopItem | undefined, after: WorkshopItem, levels?: Pipeline) => isLow(after, levels) && (!before || !isLow(before, levels))

/** Editable categories of tools and supplies; supply categories in `liquid` track a level instead of a condition. */
export interface WorkshopCategories {
  tools: string[]
  supplies: string[]
  liquid: string[]
}

export const isLiquid = (item: WorkshopItem, kind: WorkshopKind, cats: WorkshopCategories) => item.liquid ?? (kind === 'supply' && cats.liquid.includes(item.category))

export type WorkshopSort = 'attention' | 'name' | 'category' | 'stock' | 'recent'

/** Items whose name, brand, category or notes contain every word of the query (case-insensitive). */
export function searchItems<T extends WorkshopItem>(items: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return items
  return items.filter((x) => {
    const hay = [x.name, x.brand, x.category, x.notes, ...(x.copies?.map((c) => c.notes) ?? [])].join(' ').toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** A sorted copy: `attention` puts what is low first, then by category and name. */
export function sortItems<T extends WorkshopItem>(items: T[], by: WorkshopSort, levels?: Pipeline): T[] {
  const byName = (a: WorkshopItem, b: WorkshopItem) => a.name.localeCompare(b.name)
  const byCat = (a: WorkshopItem, b: WorkshopItem) => a.category.localeCompare(b.category) || byName(a, b)
  const order: Record<WorkshopSort, (a: T, b: T) => number> = {
    attention: (a, b) => Number(isLow(b, levels)) - Number(isLow(a, levels)) || byCat(a, b),
    name: byName,
    category: byCat,
    stock: (a, b) => a.quantity - b.quantity || byName(a, b),
    recent: (a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '') || byName(a, b),
  }
  return [...items].sort(order[by])
}

export function parseCategories(raw: unknown, defaults: WorkshopCategories): WorkshopCategories {
  const r = (raw ?? {}) as Partial<WorkshopCategories>
  const list = (x: unknown, d: string[]) => (Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string' && !!y.trim()) : d)
  return { tools: list(r.tools, defaults.tools), supplies: list(r.supplies, defaults.supplies), liquid: list(r.liquid, defaults.liquid) }
}

/** Adds a category (trimmed, no duplicates ignoring case). */
export function addCategory(list: string[], name: string): string[] {
  const n = name.trim()
  if (!n) throw new Error('Give the category a name')
  if (list.some((x) => x.toLowerCase() === n.toLowerCase())) throw new Error(`"${n}" is already there`)
  return [...list, n]
}

export function addTask(t: WorkshopItem, input: { name: string; everyDays: number }, ctx: Ctx): WorkshopItem {
  const name = input.name.trim()
  if (!name) throw new Error('A task needs a name')
  if (!(input.everyDays >= 1)) throw new Error('Repeat every 1 day or more')
  return { ...t, tasks: [...t.tasks, { id: ctx.newId(), name, everyDays: Math.round(input.everyDays) }], updatedAt: ctx.now }
}

export const removeTask = (t: WorkshopItem, taskId: string, ctx: Ctx): WorkshopItem => ({ ...t, tasks: t.tasks.filter((x) => x.id !== taskId), updatedAt: ctx.now })

export const markDone = (t: WorkshopItem, taskId: string, ctx: Ctx): WorkshopItem => ({
  ...t,
  tasks: t.tasks.map((x) => (x.id === taskId ? { ...x, lastDone: ctx.now } : x)),
  updatedAt: ctx.now,
})

const DAY = 86_400_000

/** Days until the task is due (0 or less: due now; negative: overdue by that many days). */
export function daysLeft(task: ItemTask, now: string): number {
  if (!task.lastDone) return 0
  return Math.ceil((Date.parse(task.lastDone) + task.everyDays * DAY - Date.parse(now)) / DAY)
}

export const isDue = (task: ItemTask, now: string) => daysLeft(task, now) <= 0

/** Due jobs of owned items, most overdue first. */
export function dueTasks<T extends WorkshopItem>(items: T[], now: string): { item: T; task: ItemTask; daysLeft: number }[] {
  return items
    .filter((t) => t.status === 'owned')
    .flatMap((item) => item.tasks.filter((task) => isDue(task, now)).map((task) => ({ item, task, daysLeft: daysLeft(task, now) })))
    .sort((a, b) => a.daysLeft - b.daysLeft || a.item.name.localeCompare(b.item.name))
}

export const refPrefix = (kind: WorkshopKind) => (kind === 'tool' ? 'tool:' : 'supply:')

/** Shopping item to buy, restock or replace it. */
export const shopItem = (t: WorkshopItem, kind: WorkshopKind, source: string): NewShopItem => ({
  kind: 'other', name: [t.brand, t.name].filter(Boolean).join(' '), refId: `${refPrefix(kind)}${t.id}`, qty: 1, sources: [source],
})

const isTask = (x: unknown): x is ItemTask => !!x && typeof (x as ItemTask).id === 'string' && typeof (x as ItemTask).name === 'string' && typeof (x as ItemTask).everyDays === 'number'
const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d)

/** Saved items, keeping only well-formed rows and filling fields older versions did not have. */
export function parseItems(raw: unknown, defaults: { quantity: number }): WorkshopItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is WorkshopItem => !!x && typeof x.id === 'string' && typeof x.name === 'string')
    .map((x) => ({
      ...x,
      category: typeof x.category === 'string' ? x.category : 'Other',
      brand: typeof x.brand === 'string' ? x.brand : '',
      status: x.status === 'wishlist' ? 'wishlist' : 'owned',
      condition: CONDITIONS.some((c) => c.id === x.condition) ? x.condition : 'good',
      quantity: num(x.quantity, defaults.quantity),
      lowAt: num(x.lowAt, 0),
      notes: typeof x.notes === 'string' ? x.notes : '',
      tasks: Array.isArray(x.tasks) ? x.tasks.filter(isTask) : [],
      copies: Array.isArray(x.copies) && x.copies.length ? x.copies.filter((c): c is ItemCopy => !!c && typeof c === 'object').map((c) => ({ ...c, condition: CONDITIONS.some((k) => k.id === c.condition) ? c.condition : 'good', notes: typeof c.notes === 'string' ? c.notes : '' })) : undefined,
      rep: typeof x.rep === 'number' && Number.isFinite(x.rep) ? x.rep : undefined,
      updatedAt: typeof x.updatedAt === 'string' ? x.updatedAt : '',
    }))
}
