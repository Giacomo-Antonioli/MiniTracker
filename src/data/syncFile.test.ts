import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { MiniTrackerDb } from './db'
import { applySyncFile, makeSyncFile, parseSyncFile, previewSyncFile, syncFileName } from './syncFile'
import type { OwnedUnit } from '../domain/collection/types'
import type { Photo } from '../domain/photos/types'

let a: MiniTrackerDb
let b: MiniTrackerDb
const unit = (id: string) => ({ id, customName: id, lifecycle: 'active', groups: [] }) as unknown as OwnedUnit
const photo = (id: string) => ({ id, unitId: 'ua', fileName: id + '.jpg', createdAt: '2026-11-01' }) as unknown as Photo
const dev = { deviceId: 'pc', deviceName: 'Studio PC' }

beforeEach(async () => {
  a = new MiniTrackerDb('fa-' + Math.random())
  b = new MiniTrackerDb('fb-' + Math.random())
  await a.units.bulkPut([unit('ua')])
  await a.photos.bulkPut([photo('p1')])
  await a.photoFiles.put({ id: 'p1', display: new Blob(['img'], { type: 'image/jpeg' }) })
  await b.units.put(unit('ub'))
})
afterEach(async () => {
  await a.delete()
  await b.delete()
})

it('a sync file merges into another device, with photos', async () => {
  const f = await makeSyncFile(a, dev, { photos: true, now: '2026-11-05T10:00:00Z' })
  expect(syncFileName(f)).toBe('minitracker-sync-Studio-PC-2026-11-05.json')
  const back = parseSyncFile(JSON.stringify(f))
  const preview = await previewSyncFile(b, back, { mode: 'merge', applyDeletions: false })
  expect(preview.result.summary.units).toMatchObject({ added: 1 })
  await applySyncFile(b, back, preview)
  expect((await b.units.toArray()).map((u) => u.id).sort()).toEqual(['ua', 'ub'])
  expect(await b.photos.count()).toBe(1)
  expect(await (await b.photoFiles.get('p1'))!.display.text()).toBe('img')
})

it('without photos, photo records with no file are left out; overwrite replaces', async () => {
  const f = await makeSyncFile(a, dev, { photos: false })
  expect(f.photos).toBeUndefined()
  const preview = await previewSyncFile(b, f, { mode: 'overwrite', applyDeletions: false })
  await applySyncFile(b, f, preview)
  expect((await b.units.toArray()).map((u) => u.id)).toEqual(['ua'])
  expect(await b.photos.count()).toBe(0)
})

it('rejects other files', () => {
  expect(() => parseSyncFile('nope')).toThrow(/not a MiniTracker sync file/)
  expect(() => parseSyncFile('{"format":"x"}')).toThrow(/not a MiniTracker/)
  expect(() => parseSyncFile(JSON.stringify({ format: 'minitracker-sync', protocol: 99, device: dev, snapshot: { tables: {}, settings: [] } }))).toThrow(/different MiniTracker version/)
})
