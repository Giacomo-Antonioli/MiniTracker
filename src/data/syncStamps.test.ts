import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { MiniTrackerDb } from './db'
import { flushSyncStamps, putSetting } from './syncStamps'

let db: MiniTrackerDb
const P = (...parts: string[]) => JSON.stringify(parts)
const get = async (k: string) => {
  await flushSyncStamps()
  return (await db.settings.get(k))?.value
}

beforeEach(() => {
  db = new MiniTrackerDb('stamps-' + Math.random())
})
afterEach(() => db.delete())

it('stamps changed items and drops stamps of removed ones', async () => {
  await putSetting(db, 'games', [{ id: 'a' }, { id: 'b' }], '2026-11-01T00:00:00Z')
  await putSetting(db, 'games', [{ id: 'a' }, { id: 'c' }], '2026-11-02T00:00:00Z')
  expect(await get('games')).toEqual([{ id: 'a' }, { id: 'c' }])
  expect(await get('syncStamps')).toEqual({ [P('games', 'a')]: '2026-11-01T00:00:00Z', [P('games', 'c')]: '2026-11-02T00:00:00Z' })
  expect(await get('syncTombstones')).toBeUndefined()
})

it('marks deletions only when tagging is on', async () => {
  await db.settings.put({ key: 'syncPrefs', value: { tagDeletions: true } })
  await putSetting(db, 'supplies', [{ id: 'x' }], '2026-11-01T00:00:00Z')
  await putSetting(db, 'supplies', [], '2026-11-02T00:00:00Z')
  expect(await get('syncTombstones')).toEqual([{ table: 'settings', id: P('supplies', 'x'), deletedAt: '2026-11-02T00:00:00Z' }])
})

it('writes nothing extra when nothing changed', async () => {
  await db.settings.put({ key: 'currency', value: '€' })
  await putSetting(db, 'currency', '€')
  expect(await get('syncStamps')).toBeUndefined()
})
