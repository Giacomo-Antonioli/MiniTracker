import { describe, expect, it } from 'vitest'
import { createUnit } from '../collection/ownedUnit'
import { setLifecycle } from '../collection/pipeline'
import { ownedByDatasheet, pointsTable } from './owned'
import type { Datasheet } from './types'

const ctx = { now: 't', newId: (() => { let i = 0; return () => `id-${++i}` })() }
const unit = (datasheetId: string | undefined, counts: number[]) =>
  createUnit({ customName: 'U', datasheetId, groups: counts.map((count) => ({ count, status: 'built' })) }, ctx)

describe('ownedByDatasheet', () => {
  it('sums units and models per datasheet, skipping unlinked and gone units', () => {
    const units = [unit('a', [5, 5]), unit('a', [3]), unit('b', [1]), unit(undefined, [4]), setLifecycle(unit('b', [2]), 'sold', ctx)]
    const owned = ownedByDatasheet(units)
    expect(owned.get('a')).toEqual({ units: 2, models: 13 })
    expect(owned.get('b')).toEqual({ units: 1, models: 1 })
    expect(owned.size).toBe(2)
  })
})

describe('pointsTable', () => {
  const d = (points: Datasheet['points'], minModels: number, maxModels: number) =>
    ({ points, minModels, maxModels }) as Datasheet

  it('turns price steps into readable size ranges', () => {
    expect(pointsTable(d([{ fromModels: 5, points: 80 }, { fromModels: 6, points: 160 }], 5, 10))).toEqual([
      { models: '5', points: 80 },
      { models: '6–10', points: 160 },
    ])
    expect(pointsTable(d([{ fromModels: 1, points: 205 }], 1, 1))).toEqual([{ models: '1', points: 205 }])
    expect(pointsTable(d([{ fromModels: 1, points: 90 }, { fromModels: 2, points: 180 }], 1, 2))).toEqual([
      { models: '1', points: 90 },
      { models: '2', points: 180 },
    ])
  })
})
