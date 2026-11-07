import { formatMoney } from '../../i18n/format'
import { isGone } from '../collection/pipeline'
import type { OwnedUnit, Pipeline, StageId } from '../collection/types'
import type { PaintStock } from '../paints/types'
import { counts, targetIndex } from '../stats/stats'

/** One purchase (box, bundle, order) that can cover several units. Its price is shared by their model counts. */
export interface Purchase {
  id: string
  name: string
  price: number
  date?: string
  shop?: string
  unitIds: string[]
}

export function parsePurchases(raw: unknown): Purchase[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is Purchase => !!x && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.price === 'number' && Array.isArray(x.unitIds))
}

export function validatePurchase(p: Purchase): void {
  if (!p.name.trim()) throw new Error('A purchase needs a name')
  if (!(p.price >= 0)) throw new Error('Price must be zero or more')
}

const models = (u: OwnedUnit) => u.groups.reduce((n, g) => n + g.count, 0)

/** Share of each purchase per unit id: by model count, or equal when the units have no models. Unknown unit ids are ignored. */
export function purchaseShares(purchases: Purchase[], units: OwnedUnit[]): Map<string, number> {
  const byId = new Map(units.map((u) => [u.id, u]))
  const out = new Map<string, number>()
  for (const p of purchases) {
    const linked = [...new Set(p.unitIds)].map((id) => byId.get(id)).filter((u): u is OwnedUnit => !!u)
    const total = linked.reduce((n, u) => n + models(u), 0)
    for (const u of linked) out.set(u.id, (out.get(u.id) ?? 0) + (total ? (p.price * models(u)) / total : p.price / linked.length))
  }
  return out
}

/** What a unit cost: its own price plus its shares of purchases. Undefined when nothing is known. */
export function unitCost(u: OwnedUnit, shares: Map<string, number>): number | undefined {
  if (u.price === undefined && !shares.has(u.id)) return undefined
  return (u.price ?? 0) + (shares.get(u.id) ?? 0)
}

export interface CostSummary {
  /** Everything paid: unit prices, purchases and paints. */
  spent: number
  models: number
  paints: number
  /** Cost of units still in the collection, split by painted share of their models. */
  painted: number
  unpainted: number
  /** Units in the collection with no price and no purchase. */
  unpriced: number
}

export function costSummary(units: OwnedUnit[], purchases: Purchase[], stock: Iterable<PaintStock>, p: Pipeline, target: StageId = 'painted'): CostSummary {
  const shares = purchaseShares(purchases, units)
  const t = targetIndex(p, target)
  const s: CostSummary = { spent: 0, models: 0, paints: 0, painted: 0, unpainted: 0, unpriced: 0 }
  s.models = units.reduce((n, u) => n + (u.price ?? 0), 0) + purchases.reduce((n, x) => n + x.price, 0)
  for (const x of stock) s.paints += (x.price ?? 0) * x.quantity
  s.spent = s.models + s.paints
  for (const u of units) {
    if (isGone(u.lifecycle)) continue
    const cost = unitCost(u, shares)
    if (cost === undefined) {
      s.unpriced++
      continue
    }
    const c = counts(u, p, t)
    const f = c.owned ? c.painted / c.owned : 0
    s.painted += cost * f
    s.unpainted += cost * (1 - f)
  }
  return s
}

/** "€12.50" style; whole amounts without decimals. */
export function money(n: number, currency: string): string {
  return formatMoney(n, currency)
}
