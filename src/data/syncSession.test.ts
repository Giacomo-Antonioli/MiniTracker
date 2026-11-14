import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { MiniTrackerDb } from './db'
import type { Channel } from './syncChannel'
import { runSync, type SyncPlan } from './syncSession'
import type { OwnedUnit } from '../domain/collection/types'
import type { Photo } from '../domain/photos/types'

/** One end of an in-memory connection; messages arrive asynchronously like on a network. */
class FakeEnd implements Channel {
  peer!: FakeEnd
  private messageFns: ((t: string) => void)[] = []
  private closeFns: (() => void)[] = []
  send(t: string) {
    setTimeout(() => this.peer.messageFns.forEach((f) => f(t)), 0)
  }
  onMessage(f: (t: string) => void) {
    this.messageFns.push(f)
  }
  onClose(f: () => void) {
    this.closeFns.push(f)
  }
  close() {
    setTimeout(() => this.peer.closeFns.forEach((f) => f()), 0)
  }
}

function pair(): [Channel, Channel] {
  const a = new FakeEnd()
  const b = new FakeEnd()
  a.peer = b
  b.peer = a
  return [a, b]
}

let a: MiniTrackerDb
let b: MiniTrackerDb
const unit = (id: string) => ({ id, customName: id, lifecycle: 'active', groups: [] }) as unknown as OwnedUnit
const photo = (id: string) => ({ id, unitId: 'ua', fileName: id + '.jpg', createdAt: '2026-11-01' }) as unknown as Photo
const yes = { confirmChanges: async () => true, confirmPlan: async () => true }

beforeEach(async () => {
  a = new MiniTrackerDb('sessA-' + Math.random())
  b = new MiniTrackerDb('sessB-' + Math.random())
  await a.units.put(unit('ua'))
  await a.photos.put(photo('p1'))
  await a.photoFiles.put({ id: 'p1', display: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }) })
  await b.units.put(unit('ub'))
})
afterEach(async () => {
  await a.delete()
  await b.delete()
})

const run = (plan: SyncPlan, hooksB = yes) => {
  const [ca, cb] = pair()
  return Promise.all([
    runSync(a, ca, { deviceId: 'A', deviceName: 'PC' }, { starts: true, plan }, yes),
    runSync(b, cb, { deviceId: 'B', deviceName: 'Phone' }, { starts: false }, hooksB),
  ])
}

it('two-way merge with photos: both devices end up the same', async () => {
  const [ra, rb] = await run({ mode: 'merge', direction: 'both', applyDeletions: true, photos: true })
  expect(ra.applied && rb.applied).toBe(true)
  expect(rb.other?.deviceName).toBe('PC')
  for (const db of [a, b]) expect((await db.units.toCollection().primaryKeys()).sort()).toEqual(['ua', 'ub'])
  const f = await b.photoFiles.get('p1')
  expect(new Uint8Array(await f!.display.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  expect(f!.display.type).toBe('image/webp')
})

it('send-only overwrite without photos: receiver becomes the sender, sender unchanged', async () => {
  const [ra, rb] = await run({ mode: 'overwrite', direction: 'send', applyDeletions: false, photos: false })
  expect(ra.applied).toBe(false)
  expect(rb.summary?.units).toEqual({ added: 1, updated: 0, deleted: 1, kept: 0 })
  expect(await b.units.toCollection().primaryKeys()).toEqual(['ua'])
  expect(await b.photos.count()).toBe(0)
  expect(await a.units.toCollection().primaryKeys()).toEqual(['ua'])
})

it('the other device can decline', async () => {
  await expect(run({ mode: 'merge', direction: 'both', applyDeletions: true, photos: false }, { ...yes, confirmPlan: async () => false })).rejects.toThrow('Phone declined the sync')
  expect(await b.units.toCollection().primaryKeys()).toEqual(['ub'])
})

it('declining the preview changes nothing', async () => {
  const [, rb] = await run({ mode: 'merge', direction: 'send', applyDeletions: true, photos: true }, { ...yes, confirmChanges: async () => false })
  expect(rb.applied).toBe(false)
  expect(await b.units.toCollection().primaryKeys()).toEqual(['ub'])
})

it('recovers when the first hello in either direction is lost', async () => {
  for (const dropFrom of ['A', 'B'] as const) {
    const [ca, cb] = pair()
    const lossy = dropFrom === 'A' ? ca : cb
    const real = lossy.send.bind(lossy)
    let dropped = false
    lossy.send = (t: string) => (dropped ? real(t) : void (dropped = true))
    const [ra, rb] = await Promise.all([
      runSync(a, ca, { deviceId: 'A', deviceName: 'PC' }, { starts: true, plan: { mode: 'merge', direction: 'both', applyDeletions: true, photos: false } }, yes),
      runSync(b, cb, { deviceId: 'B', deviceName: 'Phone' }, { starts: false }, yes),
    ])
    expect(dropped).toBe(true)
    expect(ra.applied && rb.applied).toBe(true)
  }
}, 15_000)

it('stops when the other device disconnects before saying hello', async () => {
  const [ca, cb] = pair()
  const p = runSync(a, ca, { deviceId: 'A', deviceName: 'PC' }, { starts: true, plan: { mode: 'merge', direction: 'both', applyDeletions: true, photos: false } }, yes)
  cb.close()
  await expect(p).rejects.toThrow(/disconnected/)
})

const catalogue = (gameId: string, fetchedAt: string) => ({ gameId, gameName: gameId, source: { repo: 'o/r', commit: 'c', fetchedAt }, factions: [{ id: 'f', name: 'F', fullName: 'F' }], datasheets: [] }) as never

it('catalogues: the missing one is copied, a newer download replaces an older one, an equal one is left alone', async () => {
  await a.catalogues.bulkPut([catalogue('g1', '2026-11-01T00:00:00Z'), catalogue('g2', '2026-11-10T00:00:00Z'), catalogue('g3', '2026-11-05T00:00:00Z')])
  await b.catalogues.bulkPut([catalogue('g2', '2026-11-01T00:00:00Z'), catalogue('g3', '2026-11-05T00:00:00Z')])
  const [ra, rb] = await run({ mode: 'merge', direction: 'both', applyDeletions: true, photos: false, catalogues: true })
  expect(ra.applied && rb.applied).toBe(true)
  expect((await b.catalogues.toArray()).map((c) => c.gameId).sort()).toEqual(['g1', 'g2', 'g3'])
  expect((await b.catalogues.get('g2'))!.source.fetchedAt).toBe('2026-11-10T00:00:00Z')
})

it('catalogues are left out unless asked for, and when the changes are declined', async () => {
  await a.catalogues.put(catalogue('g1', '2026-11-01T00:00:00Z'))
  await run({ mode: 'merge', direction: 'both', applyDeletions: true, photos: false })
  expect(await b.catalogues.count()).toBe(0)
  await run({ mode: 'merge', direction: 'send', applyDeletions: true, photos: false, catalogues: true }, { ...yes, confirmChanges: async () => false })
  expect(await b.catalogues.count()).toBe(0)
})
