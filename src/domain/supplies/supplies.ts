import type { Ctx } from '../collection/types'
import type { PaintDef, PaintStock } from '../paints/types'
import type { NewShopItem } from '../shopping/types'

/** Hobby supplies with a stock and an alert level (#92). */
export interface Supply {
  id: string
  name: string
  category: string
  quantity: number
  /** Alert when the quantity is at or under this. */
  lowAt: number
  notes: string
  updatedAt: string
}

export const SUPPLY_CATEGORIES = ['Primer', 'Glue', 'Brushes', 'Varnish', 'Basing', 'Tools', 'Other']
export const LOW_SOURCE = 'Running low'

export function newSupply(input: Pick<Supply, 'name' | 'category' | 'quantity' | 'lowAt'>, ctx: Ctx): Supply {
  const name = input.name.trim()
  if (!name) throw new Error('A supply needs a name')
  return { id: ctx.newId(), name, category: input.category, quantity: input.quantity, lowAt: input.lowAt, notes: '', updatedAt: ctx.now }
}

export const isLow = (s: Supply) => s.quantity <= s.lowAt

/** True when this change takes the supply to its alert level (or it is new and already there). */
export const becameLow = (before: Supply | undefined, after: Supply) => isLow(after) && (!before || !isLow(before))

export const supplyItem = (s: Supply): NewShopItem => ({ kind: 'other', name: s.name, refId: `supply:${s.id}`, qty: 1, sources: [LOW_SOURCE] })

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

/** Saved supplies, keeping only well-formed rows. */
export function parseSupplies(raw: unknown): Supply[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is Supply => !!x && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.quantity === 'number' && typeof x.lowAt === 'number')
}
