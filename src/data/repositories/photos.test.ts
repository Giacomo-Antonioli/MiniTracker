import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createUnit } from '../../domain/collection/ownedUnit'
import type { Photo } from '../../domain/photos/types'
import { MiniTrackerDb } from '../db'
import { DexiePhotoRepository, DexieUnitRepository } from './dexie'

const photo = (id: string, unitId: string, fileName: string, takenAt = '2026-11-02'): Photo => ({
  id, owner: { kind: 'unit', unitId }, unitId, fileName, caption: '', takenAt, createdAt: takenAt,
  width: 10, height: 10, originalType: 'image/jpeg', originalBytes: 1000, displayBytes: 100, hasOriginal: true,
})
const files = (id: string) => ({ id, display: new Blob(['d']), original: new Blob(['orig']) })

describe('PhotoRepository', () => {
  it('stores photos with their files, lists per unit, reports usage, deletes', async () => {
    const db = new MiniTrackerDb(`ph-${Math.random()}`)
    const repo = new DexiePhotoRepository(db)
    await repo.add(photo('p2', 'u1', 'b.jpg', '2026-11-03'), files('p2'))
    await repo.add(photo('p1', 'u1', 'a.jpg'), files('p1'))
    await repo.add(photo('p3', 'u2', 'c.jpg'), files('p3'))

    expect((await repo.listForUnit('u1')).map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(await repo.files('p1')).toMatchObject({ id: 'p1' })
    expect(await repo.fileNameTaken('a.jpg')).toBe(true)
    expect(await repo.fileNameTaken('z.jpg')).toBe(false)
    expect(await repo.usage()).toEqual({ photos: 3, displayBytes: 300, originalBytes: 3000 })

    await repo.update({ ...photo('p1', 'u1', 'a.jpg'), hasOriginal: false, caption: 'hi' })
    expect((await repo.usage()).originalBytes).toBe(2000)

    await repo.delete('p1')
    expect(await repo.files('p1')).toBeUndefined()
    expect((await repo.listForUnit('u1')).map((p) => p.id)).toEqual(['p2'])
    await db.delete()
  })

  it('drops originals but keeps the shown copies', async () => {
    const db = new MiniTrackerDb(`ph-${Math.random()}`)
    const repo = new DexiePhotoRepository(db)
    await repo.add(photo('p1', 'u1', 'a.jpg'), files('p1'))
    await repo.add({ ...photo('p2', 'u1', 'b.jpg'), hasOriginal: false }, { id: 'p2', display: new Blob(['d']) })
    expect(await repo.dropOriginals()).toBe(1000)
    expect((await repo.usage()).originalBytes).toBe(0)
    const f = await repo.files('p1')
    expect(f?.original).toBeUndefined()
    expect(f?.display).toBeDefined()
    await db.delete()
  })

  it('refuses duplicate file names and mismatched ids', async () => {
    const db = new MiniTrackerDb(`ph-${Math.random()}`)
    const repo = new DexiePhotoRepository(db)
    await repo.add(photo('p1', 'u1', 'a.jpg'), files('p1'))
    await expect(repo.add(photo('p2', 'u1', 'a.jpg'), files('p2'))).rejects.toThrow()
    await expect(repo.add(photo('p3', 'u1', 'x.jpg'), files('p4'))).rejects.toThrow(/same id|share an id/)
    expect(await db.photoFiles.get('p2')).toBeUndefined()
    await db.delete()
  })

  it('deleting a unit deletes its photos', async () => {
    const db = new MiniTrackerDb(`ph-${Math.random()}`)
    const units = new DexieUnitRepository(db)
    const repo = new DexiePhotoRepository(db)
    const u = createUnit({ customName: 'U', groups: [] }, { now: 't', newId: () => 'u1' })
    await units.save(u)
    await repo.add(photo('p1', 'u1', 'a.jpg'), files('p1'))
    await units.delete('u1')
    expect(await db.photos.count()).toBe(0)
    expect(await db.photoFiles.count()).toBe(0)
    await db.delete()
  })
})
