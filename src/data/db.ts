import Dexie, { type Table } from 'dexie'
import type { ArmyList } from '../domain/lists/types'
import type { ShopItem, ShopList } from '../domain/shopping/types'
import type { Catalogue } from '../domain/catalogue/types'
import type { OwnedUnit, StatusEvent } from '../domain/collection/types'
import type { PaintDef, PaintStock } from '../domain/paints/types'
import type { Photo, PhotoFiles } from '../domain/photos/types'
import type { PaintScheme } from '../domain/schemes/types'
import { trackSyncedTables } from './syncTracking'

export interface SettingRow {
  key: string
  value: unknown
}

/** Bump together with a new `version(n)` block and a test in migrations.test.ts. */
export const DB_VERSION = 9

export class MiniTrackerDb extends Dexie {
  units!: Table<OwnedUnit, string>
  statusEvents!: Table<StatusEvent, string>
  settings!: Table<SettingRow, string>
  /** Game catalogues converted from BSData, one row per game system. Not included in backups. */
  catalogues!: Table<Catalogue, string>
  /** What you own of each paint (bundled or custom). */
  paintStock!: Table<PaintStock, string>
  /** Paints you added yourself. */
  customPaints!: Table<PaintDef, string>
  /** Photo metadata; image data is in photoFiles so listing stays fast. */
  photos!: Table<Photo, string>
  photoFiles!: Table<PhotoFiles, string>
  schemes!: Table<PaintScheme, string>
  /** Army lists (#51). */
  lists!: Table<ArmyList, string>
  /** Shopping list items and named lists (#87). */
  shopItems!: Table<ShopItem, string>
  shopLists!: Table<ShopList, string>

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
    // v3: paint inventory (#26).
    this.version(3).stores({ paintStock: 'paintId, stage', customPaints: 'id, brand' })
    // v4: photos (#28). File names are unique.
    this.version(4).stores({ photos: 'id, unitId, &fileName, createdAt', photoFiles: 'id' })
    // v5: paint schemes (#27).
    this.version(5).stores({ schemes: 'id, origin, factionName, basedOn, stage' })
    // v6: photos can belong to schemes (#27).
    this.version(6).stores({ photos: 'id, unitId, schemeId, &fileName, createdAt' })
    // v7: army lists (#51).
    this.version(7).stores({ lists: 'id, factionId, edition, updatedAt' })
    // v8: shopping lists (#87).
    this.version(8).stores({ shopItems: 'id, kind, bought', shopLists: 'id' })
    // v9: photos can belong to games (#164).
    this.version(9).stores({ photos: 'id, unitId, schemeId, gameId, &fileName, createdAt' })
    // Sync (#161): edit times and deletion markers on every synced table.
    trackSyncedTables(this)
  }
}
