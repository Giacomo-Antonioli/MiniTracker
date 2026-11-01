import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createUnit } from '../../domain/collection/ownedUnit'
import { addEntry, createList } from '../../domain/lists/list'
import { MiniTrackerDb } from '../db'
import { DexieListRepository, DexieUnitRepository } from './dexie'

let n = 0
const ctx = (now = 't1') => ({ now, newId: () => `id${++n}` })
const base = { name: 'A', edition: '11e' as const, factionId: 'tau', battleSize: 'strike', pointsLimit: 1000 }

describe('ListRepository', () => {
  it('saves, lists newest first, deletes, and rejects broken lists', async () => {
    const db = new MiniTrackerDb(`ls-${Math.random()}`)
    const repo = new DexieListRepository(db)
    const a = createList(base, ctx('t1'))
    const b = createList({ ...base, name: 'B' }, ctx('t2'))
    await repo.save(a)
    await repo.save(b)
    expect((await repo.list()).map((l) => l.name)).toEqual(['B', 'A'])
    await repo.delete(b.id)
    expect((await repo.list()).map((l) => l.id)).toEqual([a.id])
    await expect(repo.save({ ...a, name: '' })).rejects.toThrow(/name/)
    await db.delete()
  })

  it('deleting a unit unlinks it from list entries but keeps the entry', async () => {
    const db = new MiniTrackerDb(`ls-${Math.random()}`)
    const units = new DexieUnitRepository(db)
    const repo = new DexieListRepository(db)
    const u = createUnit({ customName: 'Crisis', datasheetId: 'crisis', groups: [{ count: 3, status: 'built' }] }, ctx())
    await units.save(u)
    const l = addEntry(createList(base, ctx()), { datasheetId: 'crisis', models: 3, ownedUnitId: u.id }, ctx())
    await repo.save(l)
    await units.delete(u.id)
    const e = (await repo.get(l.id))!.entries[0]
    expect(e.datasheetId).toBe('crisis')
    expect(e.ownedUnitId).toBeUndefined()
    await db.delete()
  })
})
