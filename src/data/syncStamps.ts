import { pruneTombstones, type Tombstone } from '../domain/sync/merge'
import { stampChanges, type Stamps } from '../domain/sync/settingsMerge'
import type { MiniTrackerDb } from './db'

/** Sync preferences (#161); undefined fields = not asked yet. */
export interface SyncPrefs {
  /** Mark deletions so a merge can apply them on other devices. */
  tagDeletions?: boolean
  /** Remembered answers for the sync questions. */
  mode?: 'merge' | 'overwrite'
  direction?: 'send' | 'receive' | 'both'
  applyDeletions?: boolean
  photos?: boolean
  /** Also copy game catalogues this device lacks (they are large). */
  catalogues?: boolean
  /** Optional TURN server for networks where a direct connection fails. */
  turn?: { urls: string; username?: string; credential?: string }
}

// Edit times are recorded in order, after the save, so saving stays as fast as before.
let queue: Promise<void> = Promise.resolve()

/** Wait until all edit times are recorded (before a sync, an export, or in tests). */
export function flushSyncStamps(): Promise<void> {
  return queue
}

/**
 * Save a Settings entry; then record which of its items changed (edit times)
 * and, when deletions are tagged, which were removed.
 */
export async function putSetting(db: MiniTrackerDb, key: string, value: unknown, now = new Date().toISOString()): Promise<void> {
  const before = (await db.settings.get(key))?.value
  await db.settings.put({ key, value })
  const { changed, removed } = stampChanges(key, before, value)
  if (!changed.length && !removed.length) return
  queue = queue.then(() => record(db, changed, removed, now)).catch((e) => console.error('sync: could not record edit times', e))
}

async function record(db: MiniTrackerDb, changed: string[], removed: string[], now: string): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const stamps = { ...(((await db.settings.get('syncStamps'))?.value as Stamps | undefined) ?? {}) }
    for (const p of changed) stamps[p] = now
    for (const p of removed) delete stamps[p]
    await db.settings.put({ key: 'syncStamps', value: stamps })
    if (removed.length) await saveTombstones(db, removed.map((id) => ({ table: 'settings', id, deletedAt: now })), now)
  })
}

/** Queue deletion markers (when tagging is on); saved after the delete went through. */
export function addTombstones(db: MiniTrackerDb, list: Tombstone[]): void {
  queue = queue.then(() => db.transaction('rw', db.settings, () => saveTombstones(db, list, list[0]?.deletedAt ?? new Date().toISOString()))).catch((e) => console.error('sync: could not record deletions', e))
}

async function saveTombstones(db: MiniTrackerDb, list: Tombstone[], now: string): Promise<void> {
  const prefs = (await db.settings.get('syncPrefs'))?.value as SyncPrefs | undefined
  if (!prefs?.tagDeletions || !list.length) return
  const old = ((await db.settings.get('syncTombstones'))?.value as Tombstone[] | undefined) ?? []
  await db.settings.put({ key: 'syncTombstones', value: pruneTombstones([...old, ...list], now) })
}
