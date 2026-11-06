import { describe, expect, it } from 'vitest'
import { createUnit } from '../collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../collection/pipeline'
import { buildShowcase, parseShowcase, percent, showcaseSummary } from './showcase'

let n = 0
const unit = (name: string, faction: string | undefined, groups: { count: number; status: string }[], extra = {}) => ({ ...createUnit({ customName: name, factionName: faction, groups }, { now: 't', newId: () => `id${n++}` }), ...extra })

const units = [
  unit('Intercessors', 'Ultramarines', [{ count: 5, status: 'painted' }, { count: 5, status: 'built' }]),
  unit('Termagants', 'Tyranids', [{ count: 10, status: 'sprue' }]),
  unit('Wishlist tank', 'Ultramarines', [{ count: 1, status: 'wishlisted' }]),
  unit('Sold dread', 'Ultramarines', [{ count: 1, status: 'painted' }], { lifecycle: 'sold' }),
  unit('Proxy', undefined, [{ count: 2, status: 'varnished' }]),
]

describe('showcase', () => {
  it('snapshots owned models per stage, without sold units or the wishlist', () => {
    const s = buildShowcase(units, DEFAULT_PIPELINE, { owner: ' Giacomo ' }, '2026-11-06')
    expect(s.owner).toBe('Giacomo')
    expect(s.stages[0]).toBe('On sprue')
    expect(s.stages[s.painted]).toBe('Painted')
    expect(s.units.map((u) => u[0])).toEqual(['Proxy', 'Termagants', 'Intercessors'])
    const sum = showcaseSummary(s)
    expect(sum.total).toMatchObject({ models: 22, painted: 7 })
    expect(percent(sum.total)).toBe(32)
    expect(sum.factions.map((f) => [f.faction, f.models, f.painted])).toEqual([['Tyranids', 10, 0], ['Ultramarines', 10, 5], ['No faction', 2, 2]])
  })
  it('can keep only some factions and include the wishlist', () => {
    const s = buildShowcase(units, DEFAULT_PIPELINE, { owner: '', factions: ['Ultramarines'], wishlist: true }, 'now')
    expect(s.stages[0]).toBe('Wishlisted')
    expect(s.units.map((u) => u[0])).toEqual(['Intercessors', 'Wishlist tank'])
  })
  it('reads a snapshot back and rejects broken ones', () => {
    const s = buildShowcase(units, DEFAULT_PIPELINE, { owner: 'G' }, 'now')
    expect(parseShowcase(JSON.stringify(s))).toEqual(s)
    const bad = { ...s, units: [...s.units, ['x', 'y', [1]], 'junk'] }
    expect(parseShowcase(JSON.stringify(bad)).units).toHaveLength(s.units.length)
    expect(() => parseShowcase('{')).toThrow(/broken/)
    expect(() => parseShowcase('{"format":"x"}')).toThrow(/not a MiniTracker collection/)
    expect(() => parseShowcase(JSON.stringify({ ...s, v: 2 }))).toThrow(/newer/)
    expect(percent({ models: 0, painted: 0, byStage: [] })).toBe(0)
  })
})
