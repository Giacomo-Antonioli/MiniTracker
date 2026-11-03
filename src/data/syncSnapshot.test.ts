import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { MiniTrackerDb } from './db'
import { applySnapshot, readSnapshot } from './syncSnapshot'
import { syncSnapshots } from '../domain/sync/snapshot'
import { SYNCED_TABLES } from './syncTracking'
import type { OwnedUnit } from '../domain/collection/types'
import type { Photo } from '../domain/photos/types'

let a: MiniTrackerDb
let b: MiniTrackerDb
const unit = (id: string, name: string) => ({ id, customName: name, lifecycle: 'active', groups: [] }) as unknown as OwnedUnit
const photo = (id: string) => ({ id, unitId: 'u1', fileName: id + '.jpg', createdAt: '2026-11-01' }) as unknown as Photo

beforeEach(() => {
  a = new MiniTrackerDb('snapA-' + Math.random())
  b = new MiniTrackerDb('snapB-' + Math.random())
})
afterEach(async () => {
  await a.delete()
  await b.delete()
})

it('two devices end up with each other’s new data and photos', async () => {
  await a.units.put(unit('u1', 'From A'))
  await a.photos.put(photo('p1'))
  await a.photoFiles.put({ id: 'p1', display: new Blob(['A']) })
  await b.units.put(unit('u2', 'From B'))
  await b.photoFiles.put({ id: 'stale', display: new Blob(['x']) })

  const out = syncSnapshots(await readSnapshot(b), await readSnapshot(a), SYNCED_TABLES, { mode: 'merge', applyDeletions: true, now: new Date().toISOString() })
  expect(out.needPhotos).toEqual(['p1'])
  await applySnapshot(b, out.snapshot, [(await a.photoFiles.get('p1'))!])

  expect((await b.units.toArray()).map((u) => u.customName).sort()).toEqual(['From A', 'From B'])
  expect(await b.photoFiles.toCollection().primaryKeys()).toEqual(['p1'])
  // Applying keeps the records' own edit times.
  expect(((await b.units.get('u1')) as unknown as { syncAt: string }).syncAt).toBe(((await a.units.get('u1')) as unknown as { syncAt: string }).syncAt)
})
