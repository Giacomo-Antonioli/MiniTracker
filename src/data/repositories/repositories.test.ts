import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createUnit } from '../../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE, addStage, moveModels } from '../../domain/collection/pipeline'
import { MiniTrackerDb } from '../db'
import { DexieEventRepository, DexieSettingsRepository, DexieUnitRepository } from './dexie'

const T0 = '2026-11-01T10:00:00.000Z'
let n = 0
const ctx = { now: T0, newId: () => `id-${++n}` }

let db: MiniTrackerDb
let units: DexieUnitRepository
let events: DexieEventRepository
let settings: DexieSettingsRepository

beforeEach(async () => {
  db = new MiniTrackerDb(`test-${Math.random()}`)
  await db.open()
  units = new DexieUnitRepository(db)
  events = new DexieEventRepository(db)
  settings = new DexieSettingsRepository(db)
})

afterEach(async () => {
  await db.delete()
})

const squad = () => createUnit({ customName: 'Squad', groups: [{ count: 5, status: 'built', loadout: ['bolter'] }] }, ctx)

describe('UnitRepository', () => {
  it('saves and loads a unit unchanged', async () => {
    const u = squad()
    await units.save(u)
    expect(await units.get(u.id)).toEqual(u)
  })

  it('returns undefined for a missing unit', async () => {
    expect(await units.get('missing')).toBeUndefined()
  })

  it('lists units sorted by name', async () => {
    const b = createUnit({ customName: 'Bravo', groups: [] }, ctx)
    const a = createUnit({ customName: 'alpha', groups: [] }, ctx)
    await units.save(b)
    await units.save(a)
    expect((await units.list()).map((u) => u.customName)).toEqual(['alpha', 'Bravo'])
  })

  it('overwrites on save', async () => {
    const u = squad()
    await units.save(u)
    await units.save({ ...u, notes: 'edited' })
    expect((await units.get(u.id))?.notes).toBe('edited')
    expect(await units.list()).toHaveLength(1)
  })

  it('deleting a unit also deletes its history', async () => {
    const u = squad()
    const { unit, event } = moveModels(u, u.groups[0].id, 2, 'primed', DEFAULT_PIPELINE, ctx)
    await units.recordMove(unit, event)
    await units.delete(u.id)
    expect(await units.get(u.id)).toBeUndefined()
    expect(await events.listForUnit(u.id)).toEqual([])
  })
})

describe('recordMove', () => {
  it('saves the unit and its event together', async () => {
    const u = squad()
    const { unit, event } = moveModels(u, u.groups[0].id, 2, 'primed', DEFAULT_PIPELINE, ctx)
    await units.recordMove(unit, event)
    expect(await units.get(u.id)).toEqual(unit)
    expect(await events.listForUnit(u.id)).toEqual([event])
    expect(await events.listAll()).toEqual([event])
  })

  it('saves nothing if the event is invalid', async () => {
    const u = squad()
    const { unit, event } = moveModels(u, u.groups[0].id, 2, 'primed', DEFAULT_PIPELINE, ctx)
    await expect(units.recordMove(unit, { ...event, unitId: 'other' })).rejects.toThrow(/unit/)
    expect(await units.get(u.id)).toBeUndefined()
    expect(await events.listForUnit(u.id)).toEqual([])
  })
})

describe('EventRepository', () => {
  it('lists a unit history oldest first', async () => {
    let u = squad()
    const first = moveModels(u, u.groups[0].id, 5, 'primed', DEFAULT_PIPELINE, ctx, { date: '2026-10-02' })
    u = first.unit
    const second = moveModels(u, u.groups[0].id, 5, 'painted', DEFAULT_PIPELINE, ctx, { date: '2026-10-20' })
    await units.recordMove(second.unit, second.event)
    await units.recordMove(second.unit, first.event)
    expect((await events.listForUnit(u.id)).map((e) => e.to)).toEqual(['primed', 'painted'])
  })
})

describe('SettingsRepository', () => {
  it('returns the default pipeline until one is saved', async () => {
    expect(await settings.getPipeline()).toEqual(DEFAULT_PIPELINE)
  })

  it('saves a custom pipeline', async () => {
    const p = addStage(DEFAULT_PIPELINE, { id: 'washed', name: 'Washed' }, 'basecoated')
    await settings.savePipeline(p)
    expect(await settings.getPipeline()).toEqual(p)
  })

  it('keeps separate pipelines for paints and schemes, with their own defaults', async () => {
    expect((await settings.getPipeline('paint')).stages[0].id).toBe('wishlist')
    expect((await settings.getPipeline('scheme')).stages[0].id).toBe('idea')
    await settings.savePipeline({ stages: [{ id: 'mine', name: 'Mine' }] }, 'paint')
    expect((await settings.getPipeline('paint')).stages).toEqual([{ id: 'mine', name: 'Mine' }])
    expect(await settings.getPipeline()).toEqual(DEFAULT_PIPELINE)
  })

  it('refuses to save an invalid pipeline', async () => {
    await expect(settings.savePipeline({ stages: [] })).rejects.toThrow(/at least one/)
  })
})
