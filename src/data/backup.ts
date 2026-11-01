import type { OwnedUnit, StatusEvent } from '../domain/collection/types'
import type { MiniTrackerDb, SettingRow } from './db'

export const BACKUP_FORMAT = 'minitracker-backup'
/** Bump when the file layout changes; parseBackup must keep reading older versions. */
export const BACKUP_VERSION = 1

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  data: {
    units: OwnedUnit[]
    statusEvents: StatusEvent[]
    settings: SettingRow[]
  }
}

export async function exportBackup(db: MiniTrackerDb, now: string): Promise<Backup> {
  const [units, statusEvents, settings] = await Promise.all([db.units.toArray(), db.statusEvents.toArray(), db.settings.toArray()])
  // Sort so two exports of the same data are identical.
  const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id)
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    data: { units: units.sort(byId), statusEvents: statusEvents.sort(byId), settings: settings.sort((a, b) => a.key.localeCompare(b.key)) },
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
  return b as Backup
}

/** Replace ALL data with the backup's content, in one transaction (all or nothing). */
export async function importBackup(db: MiniTrackerDb, backup: Backup): Promise<void> {
  const { units, statusEvents, settings } = backup.data
  await db.transaction('rw', db.units, db.statusEvents, db.settings, async () => {
    await Promise.all([db.units.clear(), db.statusEvents.clear(), db.settings.clear()])
    await db.units.bulkAdd(units)
    await db.statusEvents.bulkAdd(statusEvents)
    await db.settings.bulkAdd(settings)
  })
}
