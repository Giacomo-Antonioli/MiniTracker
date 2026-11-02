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

  it('v4 → v5 adds an empty schemes table and keeps photos', async () => {
    const name = `mig-${Math.random()}`
    const v4 = new Dexie(name)
    v4.version(1).stores({ units: 'id, customName, lifecycle, factionId, updatedAt', statusEvents: 'id, unitId, date', settings: 'key' })
    v4.version(2).stores({ catalogues: 'gameId' })
    v4.version(3).stores({ paintStock: 'paintId, stage', customPaints: 'id, brand' })
    v4.version(4).stores({ photos: 'id, unitId, &fileName, createdAt', photoFiles: 'id' })
    await v4.table('photos').put({ id: 'p1', unitId: 'u1', fileName: 'a.jpg', createdAt: 't' })
    v4.close()

    const db = new MiniTrackerDb(name)
    await db.open()
    expect(await db.schemes.count()).toBe(0)
    expect(await db.photos.get('p1')).toBeDefined()
    await db.delete()
  })

  it('v5 → v6 indexes photos by scheme and keeps existing photos', async () => {
    const name = `mig-${Math.random()}`
    const v5 = new Dexie(name)
    v5.version(1).stores({ units: 'id, customName, lifecycle, factionId, updatedAt', statusEvents: 'id, unitId, date', settings: 'key' })
    v5.version(2).stores({ catalogues: 'gameId' })
    v5.version(3).stores({ paintStock: 'paintId, stage', customPaints: 'id, brand' })
    v5.version(4).stores({ photos: 'id, unitId, &fileName, createdAt', photoFiles: 'id' })
    v5.version(5).stores({ schemes: 'id, origin, factionName, basedOn, stage' })
    await v5.table('photos').put({ id: 'p1', unitId: 'u1', fileName: 'a.jpg', createdAt: 't' })
    v5.close()

    const db = new MiniTrackerDb(name)
    await db.open()
    expect(await db.photos.get('p1')).toBeDefined()
    await db.photos.put({ id: 'p2', schemeId: 's1', fileName: 'b.jpg', createdAt: 't' } as never)
    expect(await db.photos.where('schemeId').equals('s1').count()).toBe(1)
    await db.delete()
  })

  it('v6 → v7 adds an empty lists table and keeps units', async () => {
    const name = `mig-${Math.random()}`
    const v6 = new Dexie(name)
    v6.version(1).stores({ units: 'id, customName, lifecycle, factionId, updatedAt', statusEvents: 'id, unitId, date', settings: 'key' })
    v6.version(2).stores({ catalogues: 'gameId' })
    v6.version(3).stores({ paintStock: 'paintId, stage', customPaints: 'id, brand' })
    v6.version(4).stores({ photos: 'id, unitId, &fileName, createdAt', photoFiles: 'id' })
    v6.version(5).stores({ schemes: 'id, origin, factionName, basedOn, stage' })
    v6.version(6).stores({ photos: 'id, unitId, schemeId, &fileName, createdAt' })
    await v6.table('units').put({ id: 'u1', customName: 'A', lifecycle: 'active', updatedAt: 't' })
    v6.close()

    const db = new MiniTrackerDb(name)
    await db.open()
    expect(await db.units.get('u1')).toBeDefined()
    expect(await db.lists.count()).toBe(0)
    await db.delete()
  })

  it('v7 → v8 adds empty shopping tables and keeps lists', async () => {
    const name = `mig-${Math.random()}`
    const v7 = new Dexie(name)
    v7.version(1).stores({ units: 'id, customName, lifecycle, factionId, updatedAt', statusEvents: 'id, unitId, date', settings: 'key' })
    v7.version(2).stores({ catalogues: 'gameId' })
    v7.version(3).stores({ paintStock: 'paintId, stage', customPaints: 'id, brand' })
    v7.version(4).stores({ photos: 'id, unitId, &fileName, createdAt', photoFiles: 'id' })
    v7.version(5).stores({ schemes: 'id, origin, factionName, basedOn, stage' })
    v7.version(6).stores({ photos: 'id, unitId, schemeId, &fileName, createdAt' })
    v7.version(7).stores({ lists: 'id, factionId, edition, updatedAt' })
    await v7.table('lists').put({ id: 'l1', name: 'A', updatedAt: 't' })
    v7.close()

    const db = new MiniTrackerDb(name)
    await db.open()
    expect(await db.lists.get('l1')).toBeDefined()
    expect([await db.shopItems.count(), await db.shopLists.count()]).toEqual([0, 0])
    await db.delete()
  })
})
