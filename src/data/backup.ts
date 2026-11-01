import type { OwnedUnit, StatusEvent } from '../domain/collection/types'
import type { PaintDef, PaintStock } from '../domain/paints/types'
import type { Photo, PhotoFiles } from '../domain/photos/types'
import type { PaintScheme } from '../domain/schemes/types'
import { buildBackupZip, isZip, readBackupZip, type PhotoEntry, type PhotoFileRef } from './backupZip'
import type { MiniTrackerDb, SettingRow } from './db'

export const BACKUP_FORMAT = 'minitracker-backup'
/** Bump when the file layout changes; parseBackup must keep reading older versions. */
export const BACKUP_VERSION = 3

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  data: {
    units: OwnedUnit[]
    statusEvents: StatusEvent[]
    settings: SettingRow[]
    /** Added in backup v2. */
    paintStock: PaintStock[]
    customPaints: PaintDef[]
    /** Added in backup v3. */
    schemes?: PaintScheme[]
    /** Added in backup v3 (zip files only). */
    photos?: Photo[]
    photoFiles?: PhotoFileRef[]
  }
}

export async function exportBackup(db: MiniTrackerDb, now: string): Promise<Backup> {
  const [units, statusEvents, settings, paintStock, customPaints, schemes] = await Promise.all([
    db.units.toArray(),
    db.statusEvents.toArray(),
    db.settings.toArray(),
    db.paintStock.toArray(),
    db.customPaints.toArray(),
    db.schemes.toArray(),
  ])
  // Sort so two exports of the same data are identical.
  const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id)
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    data: {
      units: units.sort(byId),
      statusEvents: statusEvents.sort(byId),
      settings: settings.sort((a, b) => a.key.localeCompare(b.key)),
      paintStock: paintStock.sort((a, b) => a.paintId.localeCompare(b.paintId)),
      customPaints: customPaints.sort(byId),
      schemes: schemes.sort(byId),
    },
  }
}

/** Parse and check a backup file's text. Throws a user-readable message when it can't be used. */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON')
  }
  const b = raw as Partial<Backup>
  if (b?.format !== BACKUP_FORMAT) throw new Error('This file is not a MiniTracker backup')
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of MiniTracker; update the app first')
  }
  const d = b.data
  if (!d || !Array.isArray(d.units) || !Array.isArray(d.statusEvents) || !Array.isArray(d.settings)) {
    throw new Error('This backup file is damaged or incomplete')
  }
  // v1 files have no paint data; v1/v2 have no photos.
  const data = { ...d, paintStock: d.paintStock ?? [], customPaints: d.customPaints ?? [] }
  if (!Array.isArray(data.paintStock) || !Array.isArray(data.customPaints)) throw new Error('This backup file is damaged or incomplete')
  if (data.schemes !== undefined && !Array.isArray(data.schemes)) throw new Error('This backup file is damaged or incomplete')
  if ((data.photos && !Array.isArray(data.photos)) || (data.photoFiles && !Array.isArray(data.photoFiles))) throw new Error('This backup file is damaged or incomplete')
  return { ...(b as Backup), data }
}

/**
 * Replace ALL data with the backup's content, in one transaction (all or nothing).
 * Photos: given → replace all photos; 'keep' → leave the photo tables as they are.
 */
export async function importBackup(db: MiniTrackerDb, backup: Backup, photos: { photos: Photo[]; files: PhotoFiles[] } | 'keep' = 'keep'): Promise<void> {
  const { units, statusEvents, settings, paintStock, customPaints } = backup.data
  const tables = [db.units, db.statusEvents, db.settings, db.paintStock, db.customPaints, db.schemes, db.photos, db.photoFiles]
  await db.transaction('rw', tables, async () => {
    await Promise.all([db.units.clear(), db.statusEvents.clear(), db.settings.clear(), db.paintStock.clear(), db.customPaints.clear(), db.schemes.clear()])
    await db.schemes.bulkAdd(backup.data.schemes ?? [])
    await db.units.bulkAdd(units)
    await db.statusEvents.bulkAdd(statusEvents)
    await db.settings.bulkAdd(settings)
    await db.paintStock.bulkAdd(paintStock)
    await db.customPaints.bulkAdd(customPaints)
    if (photos !== 'keep') {
      await Promise.all([db.photos.clear(), db.photoFiles.clear()])
      await db.photos.bulkAdd(photos.photos)
      await db.photoFiles.bulkAdd(photos.files)
    }
  })
}

/** Rough size of a backup before making it. */
export function estimateBackupBytes(usage: { displayBytes: number; originalBytes: number }, includeOriginals: boolean): number {
  return usage.displayBytes + (includeOriginals ? usage.originalBytes : 0) + 50_000
}

/** Full backup as a zip: data + photos (compressed copies; originals too when asked). */
export async function exportBackupZip(db: MiniTrackerDb, now: string, includeOriginals: boolean): Promise<Blob> {
  const backup = await exportBackup(db, now)
  const photos = (await db.photos.toArray()).sort((a, b) => a.id.localeCompare(b.id))
  async function* entries(): AsyncGenerator<PhotoEntry> {
    // One photo at a time keeps memory low.
    for (const photo of photos) {
      const f = await db.photoFiles.get(photo.id)
      if (f) yield { photo, display: f.display, original: f.original }
    }
  }
  return buildBackupZip(
    entries(),
    (refs) => {
      const inZip = new Map(refs.map((r) => [r.id, r]))
      const list = photos.filter((p) => inZip.has(p.id)).map((p) => ({ ...p, hasOriginal: !!inZip.get(p.id)!.original }))
      return JSON.stringify({ ...backup, data: { ...backup.data, photos: list, photoFiles: refs } })
    },
    includeOriginals,
  )
}

/**
 * Restore from a file picked by the user: a zip (v3, with photos) or an older JSON backup (v1/v2, no photos).
 * Replaces all data. Originals missing from a light backup are kept if this device still has them.
 */
export async function importBackupFile(db: MiniTrackerDb, file: Blob): Promise<Backup> {
  if (!(await isZip(file))) {
    const backup = parseBackup(await file.text())
    // Older backups have no photos: keep photos of units that still exist, drop the rest.
    const unitIds = new Set(backup.data.units.map((u) => u.id))
    const schemeIds = new Set((backup.data.schemes ?? []).map((s) => s.id))
    const keep = (await db.photos.toArray()).filter((p) => (p.unitId && unitIds.has(p.unitId)) || (p.schemeId && schemeIds.has(p.schemeId)))
    const files = (await db.photoFiles.bulkGet(keep.map((p) => p.id))).filter((f): f is PhotoFiles => !!f)
    await importBackup(db, backup, { photos: keep, files })
    return backup
  }

  const { json, files } = await readBackupZip(file)
  const backup = parseBackup(json)
  const refs = new Map((backup.data.photoFiles ?? []).map((r) => [r.id, r]))
  const keptOriginals = new Map<string, Blob>()
  for (const p of backup.data.photos ?? []) {
    if (refs.get(p.id)?.original) continue
    const local = await db.photoFiles.get(p.id)
    if (local?.original) keptOriginals.set(p.id, local.original)
  }

  const photos: Photo[] = []
  const photoFiles: PhotoFiles[] = []
  for (const p of backup.data.photos ?? []) {
    const ref = refs.get(p.id)
    const display = ref && files.get(ref.shown)
    if (!display) continue
    const original = (ref.original && files.get(ref.original)) || keptOriginals.get(p.id)
    photos.push({ ...p, hasOriginal: !!original })
    photoFiles.push({ id: p.id, display, ...(original ? { original } : {}) })
  }

  await importBackup(db, backup, { photos, files: photoFiles })
  return backup
}
