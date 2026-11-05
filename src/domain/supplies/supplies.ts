import type { Ctx } from '../collection/types'
import type { PaintDef, PaintStock } from '../paints/types'
import type { NewShopItem } from '../shopping/types'
import { becameLow, isLow, newItem, parseItems, shopItem, type NewItem, type WorkshopItem } from '../workshop/item'

/** Hobby supplies with a stock and an alert level (#92); same fields as tools. */
export type Supply = WorkshopItem

export const SUPPLY_CATEGORIES = ['Primer', 'Glue', 'Varnish', 'Mediums', 'Brushes', 'Basing', 'Blades', 'Other']
/** Supply categories that are liquids by default: they track a level (Full … Empty). */
export const LIQUID_CATEGORIES = ['Primer', 'Glue', 'Varnish', 'Mediums']
export const LOW_SOURCE = 'Running low'
export { becameLow, isLow }

export const newSupply = (input: NewItem & { quantity: number; lowAt: number }, ctx: Ctx): Supply => newItem(input, ctx, 'A supply')

export const supplyItem = (s: Supply): NewShopItem => shopItem(s, 'supply', LOW_SOURCE)

/** Shopping items for the paints marked running low. */
export function lowPaints(stocks: Map<string, PaintStock>, paints: PaintDef[], lowStage = 'low'): NewShopItem[] {
  const byId = new Map(paints.map((p) => [p.id, p]))
  return [...stocks.values()]
    .filter((s) => s.stage === lowStage)
    .map((s) => {
      const p = byId.get(s.paintId)
      return { kind: 'paint' as const, name: p ? `${p.brand} ${p.name}` : s.paintId, refId: s.paintId, qty: 1, sources: [LOW_SOURCE] }
    })
}

/** Saved supplies (a row needs a quantity); older rows get the new fields. */
export const parseSupplies = (raw: unknown): Supply[] =>
  parseItems(Array.isArray(raw) ? raw.filter((x) => typeof x?.quantity === 'number' && typeof x?.lowAt === 'number') : [], { quantity: 0 })
