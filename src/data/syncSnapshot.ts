import type { Table } from 'dexie'
import type { PhotoFiles } from '../domain/photos/types'
import type { Snapshot } from '../domain/sync/snapshot'
import type { MiniTrackerDb } from './db'
import { flushSyncStamps } from './syncStamps'
import { SYNCED_TABLES, untracked, type SyncedTable } from './syncTracking'

const names = Object.keys(SYNCED_TABLES) as SyncedTable[]
const tableOf = (db: MiniTrackerDb, name: SyncedTable) => db[name] as unknown as Table<object, string>

/** This device's synced data (no photo files: those travel separately). */
export async function readSnapshot(db: MiniTrackerDb): Promise<Snapshot> {
  await flushSyncStamps()
  const tables: Snapshot['tables'] = {}
  for (const name of names) tables[name] = await tableOf(db, name).toArray()
  return { tables, settings: await db.settings.toArray() }
}

/**
 * Replace the synced data with a sync result, in one transaction.
 * `files` brings the photo files this device was missing; files of photos no longer present are removed.
 */
export async function applySnapshot(db: MiniTrackerDb, snapshot: Snapshot, files: PhotoFiles[] = []): Promise<void> {
  const tables = [...names.map((n) => tableOf(db, n)), db.settings, db.photoFiles]
  await untracked(() =>
    db.transaction('rw', tables, async () => {
      for (const name of names) {
        await tableOf(db, name).clear()
        await tableOf(db, name).bulkAdd(snapshot.tables[name] ?? [])
      }
      await db.settings.clear()
      await db.settings.bulkAdd(snapshot.settings)
      await db.photoFiles.bulkPut(files)
      const keep = new Set((snapshot.tables.photos ?? []).map((p) => (p as { id: string }).id))
      const gone = ((await db.photoFiles.toCollection().primaryKeys()) as string[]).filter((id) => !keep.has(id))
      await db.photoFiles.bulkDelete(gone)
    }),
  )
}
