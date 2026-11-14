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
