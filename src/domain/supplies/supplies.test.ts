import { describe, expect, it } from 'vitest'
import { becameLow, isLow, lowPaints, newSupply, parseSupplies, supplyItem } from './supplies'

const ctx = { now: 't', newId: () => 'id1' }

describe('supplies', () => {
  it('creates a supply, low when at or under its alert level', () => {
    const s = newSupply({ name: ' Primer ', category: 'Primer', quantity: 2, lowAt: 1 }, ctx)
    expect(s).toEqual({ id: 'id1', name: 'Primer', category: 'Primer', brand: '', status: 'owned', condition: 'good', boughtAt: 't', quantity: 2, lowAt: 1, notes: '', tasks: [], createdAt: 't', updatedAt: 't' })
    expect(isLow({ ...s, quantity: 0, status: 'wishlist' })).toBe(false)
    expect([isLow(s), isLow({ ...s, quantity: 1 }), isLow({ ...s, quantity: 0, lowAt: 0 })]).toEqual([false, true, true])
    expect(() => newSupply({ name: ' ', category: 'Glue', quantity: 1, lowAt: 0 }, ctx)).toThrow(/name/)
  })

  it('tells when a change makes something low, and what to put on the shopping list', () => {
    const s = newSupply({ name: 'Glue', category: 'Glue', quantity: 2, lowAt: 1 }, ctx)
    expect(becameLow(s, { ...s, quantity: 1 })).toBe(true)
    expect(becameLow({ ...s, quantity: 1 }, { ...s, quantity: 0 })).toBe(false)
    expect(becameLow(undefined, { ...s, quantity: 0 })).toBe(true)
    expect(supplyItem(s)).toEqual({ kind: 'other', name: 'Glue', refId: 'supply:id1', qty: 1, sources: ['Running low'] })
  })

  it('lists paints marked running low', () => {
    const stocks = new Map([['a', { paintId: 'a', stage: 'low', quantity: 1 }], ['b', { paintId: 'b', stage: 'in-use', quantity: 1 }]]) as never
    expect(lowPaints(stocks, [{ id: 'a', brand: 'GW', name: 'Red' }] as never)).toEqual([{ kind: 'paint', name: 'GW Red', refId: 'a', qty: 1, sources: ['Running low'] }])
  })

  it('reads saved supplies, dropping broken rows', () => {
    expect(parseSupplies([{ id: 'a', name: 'Glue', category: 'Glue', quantity: 1, lowAt: 0, notes: '', updatedAt: 't' }, { id: 'b' }, null])).toHaveLength(1)
    expect(parseSupplies('x')).toEqual([])
  })
})

it('old saved supplies get the tool fields', () => {
  expect(parseSupplies([{ id: 'a', name: 'Glue', category: 'Glue', quantity: 1, lowAt: 0, notes: '', updatedAt: 't' }])[0]).toMatchObject({ brand: '', status: 'owned', condition: 'good', tasks: [] })
})
