import { describe, expect, it } from 'vitest'
import { createUnit } from './ownedUnit'
import { DEFAULT_PIPELINE, setFlags, setLifecycle } from './pipeline'
import { filterUnits, stageTotals, unitProgress, factionsOf } from './backlog'

const ctx = { now: '2026-11-01T00:00:00.000Z', newId: (() => { let i = 0; return () => `id-${++i}` })() }
const mk = (name: string, faction: string, groups: { count: number; status: string }[]) =>
  createUnit({ customName: name, factionName: faction, groups }, ctx)

const a = setFlags(mk('Intercessors', 'Ultramarines', [{ count: 6, status: 'built' }, { count: 4, status: 'painted' }]), { favourite: true }, ctx)
const b = setFlags(mk('Termagants', 'Tyranids', [{ count: 20, status: 'sprue' }]), { nextUp: true }, ctx)
const c = setLifecycle(mk('Old Rhino', 'Ultramarines', [{ count: 1, status: 'varnished' }]), 'sold', ctx)
const all = [a, b, c]

describe('unitProgress', () => {
  it('counts models at or past painted', () => {
    expect(unitProgress(a, DEFAULT_PIPELINE)).toEqual({ done: 4, total: 10, ratio: 0.4 })
  })
})

describe('stageTotals', () => {
  it('sums models per stage in pipeline order, skipping gone units', () => {
    expect(stageTotals(all, DEFAULT_PIPELINE)).toEqual([
      { stage: DEFAULT_PIPELINE.stages[1], count: 20 },
      { stage: DEFAULT_PIPELINE.stages[2], count: 6 },
      { stage: DEFAULT_PIPELINE.stages[5], count: 4 },
    ])
  })
})

describe('filterUnits', () => {
  it('shows active and on-hold units by default (lifecycle "current")', () => {
    expect(filterUnits(all, {}).map((u) => u.customName)).toEqual(['Intercessors', 'Termagants'])
  })
  it('filters by text, case-insensitive, on name, faction and tags', () => {
    expect(filterUnits(all, { text: 'TYRA' }).map((u) => u.customName)).toEqual(['Termagants'])
  })
  it('filters by faction, stage, flags and lifecycle', () => {
    expect(filterUnits(all, { faction: 'Ultramarines', lifecycle: 'all' })).toHaveLength(2)
    expect(filterUnits(all, { stage: 'painted' }).map((u) => u.customName)).toEqual(['Intercessors'])
    expect(filterUnits(all, { favouritesOnly: true }).map((u) => u.customName)).toEqual(['Intercessors'])
    expect(filterUnits(all, { nextUpOnly: true }).map((u) => u.customName)).toEqual(['Termagants'])
    expect(filterUnits(all, { lifecycle: 'sold' }).map((u) => u.customName)).toEqual(['Old Rhino'])
  })
})

describe('factionsOf', () => {
  it('lists distinct factions sorted', () => {
    expect(factionsOf(all)).toEqual(['Tyranids', 'Ultramarines'])
  })
})
