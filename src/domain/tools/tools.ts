import type { Ctx } from '../collection/types'
import type { NewShopItem } from '../shopping/types'

/** A maintenance job that repeats, e.g. "Clean the airbrush" every 7 days. */
export interface ToolTask {
  id: string
  name: string
  everyDays: number
  /** When it was last done (ISO); never done means due now. */
  lastDone?: string
}

export type ToolStatus = 'owned' | 'wishlist'
export type ToolCondition = 'good' | 'worn' | 'broken'

/** A hobby tool you own or want: airbrush, clippers, lamp… */
export interface Tool {
  id: string
  name: string
  category: string
  brand: string
  status: ToolStatus
  condition: ToolCondition
  /** Storage place it lives in. */
  placeId?: string
  price?: number
  boughtAt?: string
  notes: string
  tasks: ToolTask[]
  createdAt: string
  updatedAt: string
}

export const TOOL_CATEGORIES = ['Airbrush', 'Cutting', 'Brushes', 'Files and sanding', 'Drill and pinning', 'Holding', 'Lighting', 'Magnification', '3D printer', 'Other']
export const CONDITIONS: { id: ToolCondition; name: string }[] = [
  { id: 'good', name: 'Good' },
  { id: 'worn', name: 'Worn' },
  { id: 'broken', name: 'Broken' },
]
export const TOOL_SOURCE = 'Tools'

/** Usual maintenance per category, offered as one-click suggestions. */
export const SUGGESTED_TASKS: Record<string, { name: string; everyDays: number }[]> = {
  Airbrush: [{ name: 'Deep clean', everyDays: 14 }, { name: 'Check needle and nozzle', everyDays: 30 }, { name: 'Drain compressor tank', everyDays: 7 }],
  Cutting: [{ name: 'Replace knife blade', everyDays: 30 }, { name: 'Check clipper edge', everyDays: 90 }],
  Brushes: [{ name: 'Clean with brush soap', everyDays: 14 }],
  'Files and sanding': [{ name: 'Clean files', everyDays: 60 }],
  Lighting: [{ name: 'Wipe lamp and diffuser', everyDays: 90 }],
  '3D printer': [{ name: 'Clean build plate', everyDays: 7 }, { name: 'Replace FEP film', everyDays: 90 }, { name: 'Filter resin', everyDays: 14 }],
}

export function newTool(input: { name: string; category: string; status?: ToolStatus }, ctx: Ctx): Tool {
  const name = input.name.trim()
  if (!name) throw new Error('A tool needs a name')
  return { id: ctx.newId(), name, category: input.category, brand: '', status: input.status ?? 'owned', condition: 'good', notes: '', tasks: [], createdAt: ctx.now, updatedAt: ctx.now }
}

export function addTask(t: Tool, input: { name: string; everyDays: number }, ctx: Ctx): Tool {
  const name = input.name.trim()
  if (!name) throw new Error('A task needs a name')
  if (!(input.everyDays >= 1)) throw new Error('Repeat every 1 day or more')
  return { ...t, tasks: [...t.tasks, { id: ctx.newId(), name, everyDays: Math.round(input.everyDays) }], updatedAt: ctx.now }
}

export const removeTask = (t: Tool, taskId: string, ctx: Ctx): Tool => ({ ...t, tasks: t.tasks.filter((x) => x.id !== taskId), updatedAt: ctx.now })

export const markDone = (t: Tool, taskId: string, ctx: Ctx): Tool => ({
  ...t,
  tasks: t.tasks.map((x) => (x.id === taskId ? { ...x, lastDone: ctx.now } : x)),
  updatedAt: ctx.now,
})

const DAY = 86_400_000

/** Days until the task is due (0 or less: due now; negative: overdue by that many days). */
export function daysLeft(task: ToolTask, now: string): number {
  if (!task.lastDone) return 0
  return Math.ceil((Date.parse(task.lastDone) + task.everyDays * DAY - Date.parse(now)) / DAY)
}

export const isDue = (task: ToolTask, now: string) => daysLeft(task, now) <= 0

/** Due jobs of owned tools, most overdue first. */
export function dueTasks(tools: Tool[], now: string): { tool: Tool; task: ToolTask; daysLeft: number }[] {
  return tools
    .filter((t) => t.status === 'owned')
    .flatMap((tool) => tool.tasks.filter((task) => isDue(task, now)).map((task) => ({ tool, task, daysLeft: daysLeft(task, now) })))
    .sort((a, b) => a.daysLeft - b.daysLeft || a.tool.name.localeCompare(b.tool.name))
}

/** Shopping item to buy a wished-for tool or replace a broken one. */
export const toolShopItem = (t: Tool): NewShopItem => ({ kind: 'other', name: [t.brand, t.name].filter(Boolean).join(' '), refId: `tool:${t.id}`, qty: 1, sources: [TOOL_SOURCE] })

const isTask = (x: unknown): x is ToolTask => !!x && typeof (x as ToolTask).id === 'string' && typeof (x as ToolTask).name === 'string' && typeof (x as ToolTask).everyDays === 'number'

/** Saved tools, keeping only well-formed rows and filling missing fields. */
export function parseTools(raw: unknown): Tool[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Tool => !!x && typeof x.id === 'string' && typeof x.name === 'string')
    .map((x) => ({
      ...x,
      category: typeof x.category === 'string' ? x.category : 'Other',
      brand: typeof x.brand === 'string' ? x.brand : '',
      status: x.status === 'wishlist' ? 'wishlist' : 'owned',
      condition: CONDITIONS.some((c) => c.id === x.condition) ? x.condition : 'good',
      notes: typeof x.notes === 'string' ? x.notes : '',
      tasks: Array.isArray(x.tasks) ? x.tasks.filter(isTask) : [],
    }))
}
