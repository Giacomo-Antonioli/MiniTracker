import { describe, expect, it } from 'vitest'
import { DEFAULT_PIPELINE } from '../collection/pipeline'
import type { OwnedUnit } from '../collection/types'
import type { PaintStock } from '../paints/types'
import { costSummary, money, parsePurchases, purchaseShares, unitCost, validatePurchase, type Purchase } from './costs'

const unit = (id: string, groups: [number, string][], extra: Partial<OwnedUnit> = {}): OwnedUnit =>
  ({ id, customName: id, lifecycle: 'active', groups: groups.map(([count, status], i) => ({ id: `${id}${i}`, count, status, loadout: [], magnetised: [] })), ...extra }) as OwnedUnit
const buy = (price: number, unitIds: string[]): Purchase => ({ id: `p${price}`, name: 'box', price, unitIds })

describe('purchaseShares', () => {
  it('splits by model count, equally when no models, ignores unknown ids and duplicates', () => {
    const units = [unit('a', [[10, 'sprue']]), unit('b', [[5, 'sprue']]), unit('c', []), unit('d', [])]
    const s = purchaseShares([buy(30, ['a', 'b', 'b', 'zz']), buy(10, ['c', 'd'])], units)
    expect(Object.fromEntries(s)).toEqual({ a: 20, b: 10, c: 5, d: 5 })
  })
})

it('unitCost adds own price and shares', () => {
  const s = new Map([['a', 20]])
  expect(unitCost(unit('a', [], { price: 5 }), s)).toBe(25)
  expect(unitCost(unit('b', [], { price: 5 }), s)).toBe(5)
  expect(unitCost(unit('c', []), s)).toBeUndefined()
})

describe('costSummary', () => {
  it('totals spending and splits value painted vs unpainted', () => {
    const units = [
      unit('a', [[2, 'painted'], [2, 'built']], { price: 40 }),
      unit('b', [[5, 'sprue']]),
      unit('c', [[1, 'sprue']]),
      unit('sold', [[1, 'painted']], { price: 100, lifecycle: 'sold' }),
      unit('wish', [[3, 'wishlisted']], { price: 9 }),
    ]
    const stock = [{ paintId: 'x', quantity: 2, price: 4.5 }, { paintId: 'y', quantity: 1 }] as PaintStock[]
    const s = costSummary(units, [buy(25, ['b'])], stock, DEFAULT_PIPELINE)
    expect(s).toEqual({ spent: 183, models: 174, paints: 9, painted: 20, unpainted: 20 + 25 + 9, unpriced: 1 })
  })
  it('wishlisted-only priced units count as unpainted', () => {
    expect(costSummary([unit('w', [[3, 'wishlisted']], { price: 9 })], [], [], DEFAULT_PIPELINE).unpainted).toBe(9)
  })
})

it('parses and validates purchases', () => {
  expect(parsePurchases('x')).toEqual([])
  expect(parsePurchases([buy(5, []), { id: 'bad' }, null])).toEqual([buy(5, [])])
  expect(() => validatePurchase({ ...buy(5, []), name: ' ' })).toThrow(/name/)
  expect(() => validatePurchase(buy(-1, []))).toThrow(/Price/)
  expect(() => validatePurchase(buy(0, []))).not.toThrow()
})

it('money', () => {
  expect(money(12, '€')).toBe('€12')
  expect(money(12.345, '£')).toBe('£12.35')
})
