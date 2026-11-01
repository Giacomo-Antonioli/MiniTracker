import Dexie, { type Table } from 'dexie'
import type { OwnedUnit, StatusEvent } from '../domain/collection/types'

export interface SettingRow {
  key: string
  value: unknown
}

/** Bump together with a new `version(n)` block and a test in migrations.test.ts. */
export const DB_VERSION = 1

export class MiniTrackerDb extends Dexie {
  units!: Table<OwnedUnit, string>
  statusEvents!: Table<StatusEvent, string>
  settings!: Table<SettingRow, string>

  constructor(name = 'minitracker') {
    super(name)
    // Only indexed fields are listed; every other field is stored as-is.
    this.version(1).stores({
      units: 'id, customName, lifecycle, factionId, updatedAt',
      statusEvents: 'id, unitId, date',
      settings: 'key',
    })
  }
}
