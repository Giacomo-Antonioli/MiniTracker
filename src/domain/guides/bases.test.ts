import { describe, expect, it } from 'vitest'
import data from '../../data/guides/bases.json'
import { baseKinds, filterBases, type BaseRecipe } from './bases'

const bases = (data as { bases: BaseRecipe[] }).bases

describe('bases', () => {
  it('finds terrain types in text', () => {
    expect(baseKinds('Snowy rocks with Astrogranite')).toEqual(['rocks', 'snow'])
    expect(baseKinds('Martian Ironearth')).toEqual(['mars'])
    expect(baseKinds('Mechanicus Standard Grey')).toEqual([])
  })

  it('filters by type and words', () => {
    expect(filterBases(bases, 'lava', '').map((b) => b.name)).toContain('Lava field')
    expect(filterBases(bases, '', 'tundra').map((b) => b.name)).toEqual(['Snowy tundra'])
    expect(filterBases(bases, 'snow', 'lava')).toEqual([])
  })

  it('ships hand-written, dedicated and scheme bases with steps and unique ids', () => {
    expect(new Set(bases.map((b) => b.origin))).toEqual(new Set(['minitracker', 'community']))
    expect(bases.some((b) => b.schemeId)).toBe(true)
    expect(new Set(bases.map((b) => b.id)).size).toBe(bases.length)
    for (const b of bases) expect(b.steps.length, b.id).toBeGreaterThan(0)
  })
})
