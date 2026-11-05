/**
 * Sync file (#161): this device's synced data (and optionally its photo files) in one file,
 * for a shared folder, USB stick or chat. Opening it on another device merges or overwrites, like a live sync.
 */
import { PROTOCOL_VERSION } from '../domain/sync/protocol'
import { syncSnapshots, type Snapshot, type SyncMode, type SyncResult } from '../domain/sync/snapshot'
import type { MiniTrackerDb } from './db'
import type { Device } from './syncDevice'
import { fromWire, toWire, withoutMissingPhotos, type WirePhoto } from './syncSession'
import { applySnapshot, readSnapshot } from './syncSnapshot'
import { SYNCED_TABLES } from './syncTracking'

export const SYNC_FILE_FORMAT = 'minitracker-sync'

export interface SyncFile {
  format: typeof SYNC_FILE_FORMAT
  protocol: number
  device: Device
  createdAt: string
  snapshot: Snapshot
  /** Photo files, when exported with photos. */
  photos?: WirePhoto[]
}

export async function makeSyncFile(db: MiniTrackerDb, device: Device, opts: { photos: boolean; now?: string }): Promise<SyncFile> {
  const snapshot = await readSnapshot(db)
  const photos = opts.photos ? await Promise.all((await db.photoFiles.toArray()).map(toWire)) : undefined
  return { format: SYNC_FILE_FORMAT, protocol: PROTOCOL_VERSION, device, createdAt: opts.now ?? new Date().toISOString(), snapshot, ...(photos ? { photos } : {}) }
}

export const syncFileName = (f: SyncFile) => `minitracker-sync-${f.device.deviceName.replace(/[^\w-]+/g, '-')}-${f.createdAt.slice(0, 10)}.json`

export function parseSyncFile(text: string): SyncFile {
  let f: Partial<SyncFile>
  try {
    f = JSON.parse(text) as Partial<SyncFile>
  } catch {
    throw new Error('This is not a MiniTracker sync file')
  }
  if (f.format !== SYNC_FILE_FORMAT || !f.snapshot?.tables || !Array.isArray(f.snapshot.settings) || !f.device) throw new Error('This is not a MiniTracker sync file')
  if (f.protocol !== PROTOCOL_VERSION) throw new Error('This sync file comes from a different MiniTracker version; update both devices')
  return f as SyncFile
}

/** What this device would look like after taking in the file. */
export async function previewSyncFile(db: MiniTrackerDb, f: SyncFile, opts: { mode: SyncMode; applyDeletions: boolean; now?: string }): Promise<{ mine: Snapshot; result: SyncResult }> {
  const mine = await readSnapshot(db)
  return { mine, result: syncSnapshots(mine, f.snapshot, SYNCED_TABLES, { ...opts, now: opts.now ?? new Date().toISOString() }) }
}

/** Apply a preview; photos the file doesn't carry are only kept when their files are already here. */
export async function applySyncFile(db: MiniTrackerDb, f: SyncFile, preview: { mine: Snapshot; result: SyncResult }): Promise<void> {
  const carried = new Map((f.photos ?? []).map((p) => [p.id, p]))
  const files = preview.result.needPhotos.filter((id) => carried.has(id)).map((id) => fromWire(carried.get(id)!))
  const have = new Set([...(preview.mine.tables.photos ?? []).map((p) => (p as { id: string }).id), ...files.map((x) => x.id)])
  const snapshot = withoutMissingPhotos(preview.result.snapshot, { ...preview.mine, tables: { ...preview.mine.tables, photos: [...have].map((id) => ({ id })) } })
  await applySnapshot(db, snapshot, files)
}
