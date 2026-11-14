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
  createdAt?: string
  updatedAt: string
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
export const isLow = (s: WorkshopItem, levels?: Pipeline) => s.status === 'owned' && (s.quantity <= s.lowAt || levelIsLow(s.level, levels))

/** True when this change takes the item to its alert level (or it is new and already there). */
export const becameLow = (before: WorkshopItem | undefined, after: WorkshopItem, levels?: Pipeline) => isLow(after, levels) && (!before || !isLow(before, levels))

/** Editable categories of tools and supplies; supply categories in `liquid` track a level instead of a condition. */
export interface WorkshopCategories {
  tools: string[]
  supplies: string[]
  liquid: string[]
}

export const isLiquid = (item: WorkshopItem, kind: WorkshopKind, cats: WorkshopCategories) => kind === 'supply' && cats.liquid.includes(item.category)

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
      updatedAt: typeof x.updatedAt === 'string' ? x.updatedAt : '',
    }))
}
