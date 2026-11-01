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
})
