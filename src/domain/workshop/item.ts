import type { Ctx } from '../collection/types'
import type { NewShopItem } from '../shopping/types'

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
  return {
    id: ctx.newId(), name, category: input.category, brand: '', status: input.status ?? 'owned', condition: 'good',
    quantity: input.quantity ?? 1, lowAt: input.lowAt ?? 0, notes: '', tasks: [], createdAt: ctx.now, updatedAt: ctx.now,
  }
}

/** Owned and at or under its alert level. */
export const isLow = (s: WorkshopItem) => s.status === 'owned' && s.quantity <= s.lowAt

/** True when this change takes the item to its alert level (or it is new and already there). */
export const becameLow = (before: WorkshopItem | undefined, after: WorkshopItem) => isLow(after) && (!before || !isLow(before))

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
