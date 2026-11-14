import type { Ctx } from '../collection/types'
import { newItem, parseItems, shopItem, type ItemStatus, type WorkshopItem } from '../workshop/item'

export { addTask, CONDITIONS, daysLeft, dueTasks, isDue, markDone, removeTask } from '../workshop/item'
export type { ItemCondition as ToolCondition, ItemStatus as ToolStatus, ItemTask as ToolTask } from '../workshop/item'

/** A hobby tool you own or want: airbrush, clippers, lamp… */
export type Tool = WorkshopItem

export const TOOL_CATEGORIES = ['Airbrush', 'Cutting', 'Brushes', 'Files and sanding', 'Drill and pinning', 'Holding', 'Lighting', 'Magnification', 'Palette', '3D printer', 'Other']
export const TOOL_SOURCE = 'Tools'

/** Usual maintenance per category, offered as one-click suggestions (tools and supplies). */
export const SUGGESTED_TASKS: Record<string, { name: string; everyDays: number }[]> = {
  Airbrush: [{ name: 'Deep clean', everyDays: 14 }, { name: 'Check needle and nozzle', everyDays: 30 }, { name: 'Drain compressor tank', everyDays: 7 }],
  Cutting: [{ name: 'Replace knife blade', everyDays: 30 }, { name: 'Check clipper edge', everyDays: 90 }],
  Brushes: [{ name: 'Clean with brush soap', everyDays: 14 }],
  'Files and sanding': [{ name: 'Clean files', everyDays: 60 }],
  Lighting: [{ name: 'Wipe lamp and diffuser', everyDays: 90 }],
  Palette: [{ name: 'Change the paper', everyDays: 3 }, { name: 'Rinse the sponge', everyDays: 7 }],
  '3D printer': [{ name: 'Clean build plate', everyDays: 7 }, { name: 'Replace FEP film', everyDays: 90 }, { name: 'Filter resin', everyDays: 14 }],
  Glue: [{ name: 'Check it has not dried out', everyDays: 90 }],
  Primer: [{ name: 'Check spray nozzle', everyDays: 60 }],
}

export const newTool = (input: { name: string; category: string; status?: ItemStatus; quantity?: number; lowAt?: number }, ctx: Ctx): Tool => newItem(input, ctx, 'A tool')

/** Shopping item to buy a wished-for tool or replace a broken one. */
export const toolShopItem = (t: Tool) => shopItem(t, 'tool', TOOL_SOURCE)

export const parseTools = (raw: unknown): Tool[] => parseItems(raw, { quantity: 1 })

/** The AK Interactive wet palette (AK-9510): the tray as a tool, and its sheets and sponges (40 and 2 in the set) as supplies. */
export function wetPaletteSet(existing: { tools: WorkshopItem[]; supplies: WorkshopItem[] }, ctx: Ctx): { tool?: Tool; supplies: WorkshopItem[] } {
  const has = (list: WorkshopItem[], name: string) => list.some((x) => x.name.toLowerCase() === name.toLowerCase())
  const tool = has(existing.tools, 'AK Interactive Wet Palette') ? undefined : { ...newTool({ name: 'AK Interactive Wet Palette', category: 'Palette' }, ctx), brand: 'AK Interactive', notes: 'AK-9510, 23.5 x 17.5 x 2.5 cm, with lid' }
  const supplies = [
    { name: 'Wet palette paper sheets', quantity: 40, lowAt: 10 },
    { name: 'Wet palette sponges', quantity: 2, lowAt: 1 },
  ].filter((x) => !has(existing.supplies, x.name)).map((x) => ({ ...newItem({ ...x, category: 'Other' }, ctx, 'A supply'), brand: 'AK Interactive' }))
  return { tool, supplies }
}

/** Vallejo's airbrush liquids as liquid supplies (their level is tracked); what is already there is left alone. */
export function airbrushLiquids(existing: { supplies: WorkshopItem[] }, ctx: Ctx): WorkshopItem[] {
  const has = (name: string) => existing.supplies.some((x) => x.name.toLowerCase() === name.toLowerCase())
  const liquids = [
    { name: 'Vallejo Airbrush Thinner', category: 'Mediums', notes: 'Thins paint so it atomises: up to 25% of the mix.' },
    { name: 'Vallejo Airbrush Flow Improver', category: 'Mediums', notes: 'Keeps paint flowing and slows drying on the needle: 1-3 drops per 10 drops of paint. It is also a retarder, so use little.' },
    { name: 'Vallejo Airbrush Cleaner', category: 'Other', notes: 'To clean the airbrush after use.' },
    { name: 'Vallejo Retarder Medium', category: 'Mediums', notes: 'Slows drying (water based).' },
  ]
  return liquids.filter((x) => !has(x.name)).map((x) => ({ ...newItem({ name: x.name, category: x.category }, ctx, 'A supply'), brand: 'Vallejo', liquid: true, notes: x.notes }))
}

export type AirbrushFeed = 'gravity' | 'siphon'
export type AirbrushAction = 'single' | 'dual'
export const AIRBRUSH_NOZZLES = [0.2, 0.3, 0.35, 0.4, 0.5, 0.7]

/** An airbrush as a tool, named after its feed, action and nozzle (e.g. "Airbrush (gravity feed, dual action, 0.3 mm)"). */
export function airbrushTool(spec: { feed: AirbrushFeed; action: AirbrushAction; nozzle: number }, ctx: Ctx): Tool {
  const name = `Airbrush (${spec.feed === 'gravity' ? 'gravity feed' : 'siphon feed'}, ${spec.action === 'dual' ? 'dual action' : 'single action'}, ${spec.nozzle} mm)`
  const notes = [
    spec.feed === 'gravity' ? 'Gravity feed: cup on top, fine detail and little paint waste.' : 'Siphon feed: bottle below, holds more paint, good for large areas.',
    spec.action === 'dual' ? 'Dual action: the trigger controls air and paint separately, for finer control.' : 'Single action: air and paint come out together, simple to use.',
    spec.nozzle <= 0.3 ? `${spec.nozzle} mm: detail and gradients on small models.` : spec.nozzle <= 0.4 ? `${spec.nozzle} mm: a good all-rounder.` : `${spec.nozzle} mm: base coats and primer on larger areas.`,
  ].join(' ')
  return { ...newTool({ name, category: 'Airbrush' }, ctx), notes }
}
