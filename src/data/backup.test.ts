import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createUnit } from '../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE, addStage, moveModels } from '../domain/collection/pipeline'
import { BACKUP_FORMAT, BACKUP_VERSION, exportBackup, importBackup, parseBackup } from './backup'
import { MiniTrackerDb } from './db'
import { DexieSettingsRepository, DexieUnitRepository } from './repositories/dexie'

const ctx = { now: '2026-11-01T10:00:00.000Z', newId: (() => { let i = 0; return () => `id-${++i}` })() }
let db: MiniTrackerDb

beforeEach(async () => {
  db = new MiniTrackerDb(`bk-${Math.random()}`)
  await db.open()
})
afterEach(async () => {
  await db.delete()
})

async function seed(target: MiniTrackerDb) {
  const u = createUnit({ customName: 'Squad', factionName: 'Ultramarines', groups: [{ count: 5, status: 'built' }] }, ctx)
  const { unit, event } = moveModels(u, u.groups[0].id, 2, 'primed', DEFAULT_PIPELINE, ctx, { note: 'hi' })
  await new DexieUnitRepository(target).recordMove(unit, event)
  await target.settings.put({ key: 'another', value: 1 })
  await new DexieSettingsRepository(target).savePipeline(addStage(DEFAULT_PIPELINE, { id: 'washed', name: 'Washed' }))
}

describe('backup', () => {
  it('exports a versioned file with all tables', async () => {
    await seed(db)
    const b = await exportBackup(db, '2026-11-02T00:00:00.000Z')
    expect(b).toMatchObject({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: '2026-11-02T00:00:00.000Z' })
    expect(b.data.units).toHaveLength(1)
    expect(b.data.statusEvents).toHaveLength(1)
    expect(b.data.settings).toHaveLength(2)
  })

  it('round-trips: export → JSON text → import gives identical data', async () => {
    await seed(db)
    const before = await exportBackup(db, 'x')
    const other = new MiniTrackerDb(`bk-${Math.random()}`)
    await other.open()
    await other.units.put({ ...before.data.units[0], id: 'stale' })
    await importBackup(other, parseBackup(JSON.stringify(before)))
    const after = await exportBackup(other, 'x')
    expect(after).toEqual(before)
    await other.delete()
  })

  it('rejects files that are not MiniTracker backups', () => {
    expect(() => parseBackup('not json')).toThrow(/not valid JSON/)
    expect(() => parseBackup('{"format":"other"}')).toThrow(/not a MiniTracker backup/)
    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 999, data: {} }))).toThrow(/newer version/)
    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, data: { units: 'x' } }))).toThrow(/damaged/)
  })

  it('leaves existing data untouched when the import fails midway', async () => {
    await seed(db)
    const good = await exportBackup(db, 'x')
    const bad = { ...good, data: { ...good.data, units: [{ customName: 'no id' } as never] } }
    await expect(importBackup(db, bad)).rejects.toThrow()
    expect(await db.units.count()).toBe(1)
  })
})
