import { describe, expect, it } from 'vitest'
import { addCategory, becameLow, isLiquid, isLow, levelIsLow, newItem, parseCategories } from './item'

const c = { now: 't', newId: () => 'x' }
const cats = { tools: ['Cutting'], supplies: ['Glue', 'Basing'], liquid: ['Glue'] }

it('a liquid running low or empty counts as low, also with edited levels', () => {
  const glue = newItem({ name: 'Glue', category: 'Glue', quantity: 3, lowAt: 0 }, c)
  expect(isLow(glue)).toBe(false)
  expect(isLow({ ...glue, level: 'half' })).toBe(false)
  expect(isLow({ ...glue, level: 'low' })).toBe(true)
  expect(isLow({ ...glue, level: 'empty' })).toBe(true)
  expect(isLow({ ...glue, level: 'low', status: 'wishlist' })).toBe(false)
  const mine = { stages: [{ id: 'full', name: 'Full' }, { id: 'drops', name: 'Drops' }, { id: 'low', name: 'Low' }, { id: 'dregs', name: 'Dregs' }] }
  expect([levelIsLow('drops', mine), levelIsLow('dregs', mine), levelIsLow(undefined, mine)]).toEqual([false, true, false])
  expect(levelIsLow('low', { stages: [{ id: 'full', name: 'Full' }] })).toBe(true)
  expect(becameLow({ ...glue, level: 'half' }, { ...glue, level: 'low' })).toBe(true)
  expect(becameLow({ ...glue, level: 'low' }, { ...glue, level: 'empty' })).toBe(false)
})

it('liquid categories and editable category lists', () => {
  const glue = newItem({ name: 'Glue', category: 'Glue' }, c)
  expect([isLiquid(glue, 'supply', cats), isLiquid(glue, 'tool', cats), isLiquid({ ...glue, category: 'Basing' }, 'supply', cats)]).toEqual([true, false, false])
  expect(addCategory(['Glue'], ' Washes ')).toEqual(['Glue', 'Washes'])
  expect(() => addCategory(['Glue'], 'glue')).toThrow(/already/)
  expect(() => addCategory([], ' ')).toThrow()
  expect(parseCategories(undefined, cats)).toEqual(cats)
  expect(parseCategories({ tools: ['A', 3, ''], liquid: 'x' }, cats)).toEqual({ tools: ['A'], supplies: cats.supplies, liquid: cats.liquid })
})

describe('newItem purchase date', () => {
  it('owned items are bought today, wishlist ones are not', () => {
    const c = { now: '2026-11-14T09:00:00.000Z', newId: () => 'x' }
    expect(newItem({ name: 'Glue', category: 'Glue' }, c).boughtAt).toBe('2026-11-14')
    expect(newItem({ name: 'Glue', category: 'Glue', status: 'wishlist' }, c).boughtAt).toBeUndefined()
  })
})
