import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { MiniTrackerDb } from './db'
import { flushSyncStamps } from './syncStamps'
import { untracked } from './syncTracking'
import type { OwnedUnit } from '../domain/collection/types'

let db: MiniTrackerDb
const unit = (id: string) => ({ id, customName: id, lifecycle: 'active', groups: [] }) as unknown as OwnedUnit
const tombs = async () => {
  await flushSyncStamps()
  return (await db.settings.get('syncTombstones'))?.value
}

beforeEach(() => {
  db = new MiniTrackerDb('track-' + Math.random())
})
afterEach(() => db.delete())

it('stamps created and changed records', async () => {
  await db.units.put(unit('a'))
  const first = (await db.units.get('a')) as OwnedUnit & { syncAt: string }
  expect(first.syncAt).toMatch(/^\d{4}-/)
  await db.units.update('a', { customName: 'b' })
  expect(((await db.units.get('a')) as unknown as { syncAt: string }).syncAt >= first.syncAt).toBe(true)
})

it('marks deletions only when tagging is on, including cascades', async () => {
  await db.units.bulkPut([unit('a'), unit('b')])
  await db.units.delete('a')
  expect(await tombs()).toBeUndefined()
  await db.settings.put({ key: 'syncPrefs', value: { tagDeletions: true } })
  await db.units.where('id').equals('b').delete()
  expect(await tombs()).toEqual([expect.objectContaining({ table: 'units', id: 'b' })])
})

it('untracked writes keep their own times and make no markers', async () => {
  await db.settings.put({ key: 'syncPrefs', value: { tagDeletions: true } })
  await untracked(async () => {
    await db.units.put({ ...unit('a'), syncAt: '2020-01-01' } as OwnedUnit)
    await db.units.clear()
    await db.units.put({ ...unit('c'), syncAt: '2020-01-01' } as OwnedUnit)
  })
  expect(((await db.units.get('c')) as unknown as { syncAt: string }).syncAt).toBe('2020-01-01')
  expect(await tombs()).toBeUndefined()
})
