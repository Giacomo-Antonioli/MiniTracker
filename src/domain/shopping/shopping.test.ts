import { describe, expect, it } from 'vitest'
import { addItems, itemsOn, MAIN, newList, shoppingText, totals, withoutList } from './shopping'
import type { ShopItem } from './types'

let n = 0
const ctx = { now: 't', newId: () => `i${++n}` }

describe('shopping list', () => {
  it('adds items to main and chosen lists, reusing open items by id or name', () => {
    let { items } = addItems([], [{ kind: 'model', name: 'Big Walker', refId: 'u-w', qty: 2, sources: ['List: A'] }, { kind: 'other', name: 'Brushes ', qty: 0 }], [MAIN], ctx)
    expect(items.map((x) => [x.name, x.qty, x.listIds])).toEqual([['Big Walker', 2, []], ['Brushes', 1, []]])
    const r = addItems(items, [{ kind: 'model', name: 'Walker', refId: 'u-w', qty: 1, sources: ['List: B'], shop: 'GW', price: 50 }, { kind: 'other', name: 'brushes', qty: 3 }], [MAIN, 'l1'], ctx)
    items = r.items
    expect(r.changed).toHaveLength(2)
    expect(items[0]).toMatchObject({ qty: 2, sources: ['List: A', 'List: B'], listIds: ['l1'], shop: 'GW', price: 50 })
    expect(items[1]).toMatchObject({ qty: 3, listIds: ['l1'] })
    // A bought item is not reused.
    items = items.map((x) => (x.kind === 'other' ? { ...x, bought: true } : x))
    expect(addItems(items, [{ kind: 'other', name: 'Brushes', qty: 1 }], [], ctx).items).toHaveLength(3)
  })

  it('shows a list\'s items, open first, by kind and name; totals open items', () => {
    const it = (name: string, kind: ShopItem['kind'], o: Partial<ShopItem> = {}) => ({ id: name, name, kind, qty: 1, bought: false, sources: [], listIds: [], createdAt: 't', updatedAt: 't', ...o }) as ShopItem
    const items = [it('Sand', 'other', { price: 5 }), it('Red', 'paint', { listIds: ['l1'], price: 4.1 }), it('Walker', 'model', { bought: true, price: 60 }), it('Black', 'paint', { listIds: ['l1'] })]
    expect(itemsOn(items, MAIN).map((x) => x.name)).toEqual(['Black', 'Red', 'Sand', 'Walker'])
    expect(itemsOn(items, 'l1').map((x) => x.name)).toEqual(['Black', 'Red'])
    expect(totals(items)).toEqual({ toBuy: 3, bought: 1, price: 9.1, unpriced: 1 })
    expect(withoutList(items, 'l1', ctx).map((x) => [x.name, x.listIds])).toEqual([['Red', []], ['Black', []]])
  })

  it('names lists and writes text grouped by shop', () => {
    expect(newList(' GW order ', ctx)).toMatchObject({ name: 'GW order' })
    expect(() => newList(' ', ctx)).toThrow(/name/)
    const items = addItems([], [
      { kind: 'model', name: 'Walker', qty: 2, shop: 'GW', price: 100 },
      { kind: 'paint', name: 'Red', qty: 1 },
      { kind: 'paint', name: 'Blue', qty: 1, shop: 'Amazon', price: 3.5 },
    ], [], ctx).items
    expect(shoppingText('Shopping', items)).toBe('Shopping\n\nAmazon\n- Blue – 3.50\n\nGW\n- 2× Walker – 100.00\n\nAny shop\n- Red\n\nTotal: 103.50 (+1 without price)')
    expect(shoppingText('Shopping', [])).toBe('Shopping: nothing to buy')
  })
})
