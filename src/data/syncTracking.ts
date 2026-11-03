import type { Table } from 'dexie'
import type { Tombstone } from '../domain/sync/merge'
import type { MiniTrackerDb } from './db'
import { addTombstones } from './syncStamps'

/** Tables that sync between devices (#161), with their key field. Catalogues and photo files are not tracked. */
export const SYNCED_TABLES = {
  units: 'id',
  statusEvents: 'id',
  paintStock: 'paintId',
  customPaints: 'id',
  photos: 'id',
  schemes: 'id',
  lists: 'id',
  shopItems: 'id',
  shopLists: 'id',
} as const
export type SyncedTable = keyof typeof SYNCED_TABLES

/** Added to every synced record: when it was last created or changed on any device. */
export type SyncStamped = { syncAt?: string }

let paused = 0

/** Run without stamping or deletion markers (restore, applying a merge): records keep their own times. */
export async function untracked<T>(fn: () => Promise<T>): Promise<T> {
  paused++
  try {
    return await fn()
  } finally {
    paused--
  }
}

/** Stamp creates/edits and queue deletion markers on every synced table. Called once per database. */
export function trackSyncedTables(db: MiniTrackerDb, now: () => string = () => new Date().toISOString()): void {
  for (const name of Object.keys(SYNCED_TABLES) as SyncedTable[]) {
    const table = db[name] as unknown as Table<SyncStamped, string>
    table.hook('creating', (_key, obj) => {
      if (!paused) obj.syncAt = now()
    })
    table.hook('updating', (mods) => {
      if (paused || Object.keys(mods).every((k) => k === 'syncAt')) return undefined
      return { syncAt: now() }
    })
    table.hook('deleting', (key, _obj, trans) => {
      if (paused) return
      const t: Tombstone = { table: name, id: String(key), deletedAt: now() }
      trans.on('complete', () => addTombstones(db, [t]))
    })
  }
}
