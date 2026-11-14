import { describe, expect, it } from 'vitest'
import seed from './seed.json'

describe('bundled paints', () => {
  it('have unique ids', () => {
    const ids = seed.paints.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('include the Vallejo airbrush ranges as type air, with their range and a code in the id', () => {
    const air = seed.paints.filter((p) => p.brand === 'Vallejo' && p.type === 'air')
    const byRange = (r: string) => air.filter((p) => 'range' in p && p.range === r).length
    expect([byRange('Model Air'), byRange('Game Air'), byRange('Premium Airbrush Color')]).toEqual([235, 100, 60])
    expect(air.find((p) => p.id === 'vallejo/model-air-71-281')?.name).toBe('3B Russian Green')
  })

  it('keep the older Vallejo ids, so saved stock still finds its paint', () => {
    expect(seed.paints.some((p) => p.id === 'vallejo/dead-white')).toBe(true)
  })
})
