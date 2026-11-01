import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Photo } from '../domain/photos/types'
import { exportBackup, exportBackupZip, importBackupFile } from './backup'
import { readBackupZip } from './backupZip'
import { MiniTrackerDb } from './db'

// Note: fake IndexedDB doesn't keep Blob contents, so byte-level checks live in e2e/backup-photos.spec.ts.

let db: MiniTrackerDb
beforeEach(async () => {
  db = new MiniTrackerDb(`bf-${Math.random()}`)
  await db.open()
})
afterEach(async () => {
  await db.delete()
})

const photo = (id: string, unitId: string): Photo => ({
  id, owner: { kind: 'unit', unitId }, unitId, fileName: `f_${id}.jpg`, caption: 'c', takenAt: 't', createdAt: 't',
  width: 1, height: 1, originalType: 'image/jpeg', originalBytes: 10, displayBytes: 2, hasOriginal: true,
})

async function seed() {
  await db.units.bulkPut([
    { id: 'u1', customName: 'One', groups: [] } as never,
    { id: 'u2', customName: 'Two', groups: [] } as never,
  ])
  await db.photos.bulkPut([photo('p1', 'u1'), photo('p2', 'u2')])
  await db.photoFiles.bulkPut([
    { id: 'p1', display: new Blob(['d1'], { type: 'image/webp' }), original: new Blob(['o1']) },
    { id: 'p2', display: new Blob(['d2'], { type: 'image/webp' }), original: new Blob(['o2']) },
  ])
}

describe('backup files with photos', () => {
  it('zip export lists photos and their files in backup.json (light vs full)', async () => {
    await seed()
    const full = JSON.parse((await readBackupZip(await exportBackupZip(db, 'now', true))).json)
    expect(full.version).toBe(3)
    expect(full.data.photos.map((p: Photo) => [p.id, p.hasOriginal])).toEqual([['p1', true], ['p2', true]])
    expect(full.data.photoFiles[0]).toEqual({ id: 'p1', shown: 'photos/shown/f_p1.webp', original: 'photos/original/f_p1.jpg' })

    const light = JSON.parse((await readBackupZip(await exportBackupZip(db, 'now', false))).json)
    expect(light.data.photos.map((p: Photo) => p.hasOriginal)).toEqual([false, false])
  })

  it('zip import replaces all photos; a light backup keeps originals still on this device', async () => {
    await seed()
    const light = await exportBackupZip(db, 'now', false)
    await db.photos.delete('p2')
    await db.photoFiles.delete('p2')
    await importBackupFile(db, light)
    const photos = (await db.photos.toArray()).sort((a, b) => a.id.localeCompare(b.id))
    expect(photos.map((p) => [p.id, p.hasOriginal])).toEqual([['p1', true], ['p2', false]]) // p1 original kept locally
    expect(await db.units.count()).toBe(2)
  })

  it('old JSON backups keep photos of units that still exist and drop the others', async () => {
    await seed()
    const json = await exportBackup(db, 'now')
    const onlyU1 = { ...json, version: 2, data: { ...json.data, units: json.data.units.filter((u) => u.id === 'u1') } }
    await importBackupFile(db, new Blob([JSON.stringify(onlyU1)]))
    expect((await db.photos.toArray()).map((p) => p.id)).toEqual(['p1'])
    expect((await db.photoFiles.toArray()).map((f) => f.id)).toEqual(['p1'])
  })

  it('rejects damaged photo lists', async () => {
    const bad = { format: 'minitracker-backup', version: 3, exportedAt: 'x', data: { units: [], statusEvents: [], settings: [], photos: 'x' } }
    await expect(importBackupFile(db, new Blob([JSON.stringify(bad)]))).rejects.toThrow(/damaged/)
  })
})
