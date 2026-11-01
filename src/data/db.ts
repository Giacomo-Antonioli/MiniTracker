import Dexie, { type Table } from 'dexie'
import type { Catalogue } from '../domain/catalogue/types'
import type { OwnedUnit, StatusEvent } from '../domain/collection/types'

export interface SettingRow {
  key: string
  value: unknown
}

/** Bump together with a new `version(n)` block and a test in migrations.test.ts. */
export const DB_VERSION = 2

export class MiniTrackerDb extends Dexie {
  units!: Table<OwnedUnit, string>
  statusEvents!: Table<StatusEvent, string>
  settings!: Table<SettingRow, string>
  /** Game catalogues converted from BSData, one row per game system. Not included in backups. */
  catalogues!: Table<Catalogue, string>

  constructor(name = 'minitracker') {
    super(name)
    // Only indexed fields are listed; every other field is stored as-is.
    this.version(1).stores({
      units: 'id, customName, lifecycle, factionId, updatedAt',
      statusEvents: 'id, unitId, date',
      settings: 'key',
    })
    // v2: catalogues downloaded from BSData (#15).
    this.version(2).stores({ catalogues: 'gameId' })
  }
}
