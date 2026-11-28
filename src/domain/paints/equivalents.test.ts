import { describe, expect, it } from 'vitest'
import chart from '../../data/paints/conversion.json'
import seed from '../../data/paints/seed.json'
import { equivalentsOf } from './equivalents'

describe('equivalentsOf', () => {
  const groups = [['a', 'b', 'c'], ['c', 'd']]
  it('lists the other paints of every group the paint is in', () => {
    expect(equivalentsOf('a', groups)).toEqual(['b', 'c'])
    expect(equivalentsOf('c', groups)).toEqual(['a', 'b', 'd'])
  })
  it('is empty for a paint that is in no group', () => {
    expect(equivalentsOf('z', groups)).toEqual([])
  })
})

describe('bundled conversion chart', () => {
  const ids = new Set(seed.paints.map((p) => p.id))
  it('only names paints that exist in the paint list', () => {
    expect(chart.flat().filter((id) => !ids.has(id))).toEqual([])
  })
  it('lists each paint once per group', () => {
    expect(chart.filter((g) => new Set(g).size !== g.length)).toEqual([])
  })
  it('does not use one entry without a range for two different paints', () => {
    // The chart's Turquoise is Model Color 70.966 for Ahriman Blue and Game Color 72.024 for Thunderhawk Blue.
    expect(equivalentsOf('vallejo/turquoise', chart)).toEqual([])
  })
  it('links Abaddon Black to a Vallejo and an Army Painter paint', () => {
    const others = equivalentsOf('citadel/abaddon-black', chart)
    expect(others.some((id) => id.startsWith('vallejo/'))).toBe(true)
    expect(others).toContain('army_painter/matt-black')
  })
})
