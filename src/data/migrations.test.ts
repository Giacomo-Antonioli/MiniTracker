import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { DB_VERSION, MiniTrackerDb } from './db'

/**
 * Pattern for every future schema change:
 * 1. Write data with a plain Dexie instance using the OLD schema (copied here, frozen).
 * 2. Open the same database with MiniTrackerDb (current schema).
 * 3. Check the old data is still there, upgraded if needed.
 * Add one test per version bump; never edit old ones.
 */
describe('schema migrations', () => {
  it('data written with schema v1 survives opening with the current schema', async () => {
    const name = `mig-${Math.random()}`
    const v1 = new Dexie(name)
    v1.version(1).stores({ units: 'id', statusEvents: 'id, unitId', settings: 'key' })
    await v1.table('units').put({ id: 'u1', customName: 'Old squad', groups: [] })
    await v1.table('statusEvents').put({ id: 'e1', unitId: 'u1', date: '2026-01-01' })
    v1.close()

    const db = new MiniTrackerDb(name)
    await db.open()
    expect(db.verno).toBe(DB_VERSION)
    expect(await db.units.get('u1')).toMatchObject({ customName: 'Old squad' })
    expect(await db.statusEvents.where('unitId').equals('u1').count()).toBe(1)
    await db.delete()
  })

  it('v1 → v2 adds an empty catalogues table and keeps everything else', async () => {
    const name = `mig-${Math.random()}`
    const v1 = new Dexie(name)
    v1.version(1).stores({ units: 'id, customName, lifecycle, factionId, updatedAt', statusEvents: 'id, unitId, date', settings: 'key' })
    await v1.table('settings').put({ key: 'pipeline', value: { stages: [] } })
    v1.close()

    const db = new MiniTrackerDb(name)
    await db.open()
    expect(await db.catalogues.count()).toBe(0)
    expect(await db.settings.get('pipeline')).toBeDefined()
    await db.delete()
  })

  it('v2 → v3 adds empty paint tables and keeps catalogues', async () => {
    const name = `mig-${Math.random()}`
    const v2 = new Dexie(name)
    v2.version(1).stores({ units: 'id, customName, lifecycle, factionId, updatedAt', statusEvents: 'id, unitId, date', settings: 'key' })
    v2.version(2).stores({ catalogues: 'gameId' })
    await v2.table('catalogues').put({ gameId: 'g', datasheets: [] })
    v2.close()

    const db = new MiniTrackerDb(name)
    await db.open()
    expect(await db.paintStock.count()).toBe(0)
    expect(await db.customPaints.count()).toBe(0)
    expect(await db.catalogues.get('g')).toBeDefined()
    await db.delete()
  })

  it('v3 → v4 adds empty photo tables and keeps paint data', async () => {
    const name = `mig-${Math.random()}`
    const v3 = new Dexie(name)
    v3.version(1).stores({ units: 'id, customName, lifecycle, factionId, updatedAt', statusEvents: 'id, unitId, date', settings: 'key' })
    v3.version(2).stores({ catalogues: 'gameId' })
    v3.version(3).stores({ paintStock: 'paintId, stage', customPaints: 'id, brand' })
    await v3.table('paintStock').put({ paintId: 'c/nuln', stage: 'sealed', quantity: 1 })
    v3.close()

    const db = new MiniTrackerDb(name)
    await db.open()
    expect(await db.photos.count()).toBe(0)
    expect(await db.photoFiles.count()).toBe(0)
    expect(await db.paintStock.get('c/nuln')).toBeDefined()
    await db.delete()
  })
})
