import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createUnit } from '../../domain/collection/ownedUnit'
import { createScheme, makeVariant } from '../../domain/schemes/scheme'
import { MiniTrackerDb } from '../db'
import { DexieSchemeRepository, DexieUnitRepository } from './dexie'

let n = 0
const ctx = { now: 't', newId: () => `id${++n}` }

describe('SchemeRepository', () => {
  it('saves, lists by name, and deleting unlinks units and variants', async () => {
    const db = new MiniTrackerDb(`sc-${Math.random()}`)
    const repo = new DexieSchemeRepository(db)
    const units = new DexieUnitRepository(db)
    const base = createScheme({ name: 'Ultramarines', stage: 'final', origin: 'official' }, ctx)
    const variant = makeVariant(base, ctx)
    await repo.saveMany([variant, base])
    expect((await repo.list()).map((s) => s.name)).toEqual(['Ultramarines', 'Ultramarines (my variant)'])

    const u = { ...createUnit({ customName: 'U', groups: [] }, ctx), schemeId: base.id }
    await units.save(u)
    await repo.delete(base.id)
    expect((await repo.list()).map((s) => s.id)).toEqual([variant.id])
    expect((await repo.list())[0].basedOn).toBeUndefined()
    expect((await units.get(u.id))?.schemeId).toBeUndefined()
    await expect(repo.save({ ...variant, name: '' })).rejects.toThrow(/name/)
    await db.delete()
  })
})
