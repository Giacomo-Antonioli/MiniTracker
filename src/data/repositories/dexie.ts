import { validateList } from '../../domain/lists/list'
import type { ShopItem, ShopList } from '../../domain/shopping/types'
import type { ArmyList } from '../../domain/lists/types'
import { validateScheme } from '../../domain/schemes/scheme'
import type { PaintScheme } from '../../domain/schemes/types'
import type { Photo, PhotoFiles } from '../../domain/photos/types'
import type { PaintDef, PaintStock } from '../../domain/paints/types'
import type { Catalogue } from '../../domain/catalogue/types'
import { validatePipeline } from '../../domain/collection/pipeline'
import { DEFAULT_PIPELINES, type PipelineKey } from '../../domain/pipelines'
import type { OwnedUnit, Pipeline, StatusEvent } from '../../domain/collection/types'
import type { MiniTrackerDb } from '../db'
import type { EventRepository, SettingsRepository, UnitRepository } from './types'

export class DexieUnitRepository implements UnitRepository {
  private db: MiniTrackerDb
  constructor(db: MiniTrackerDb) {
    this.db = db
  }

  get(id: string) {
    return this.db.units.get(id)
  }

  async list() {
    const all = await this.db.units.toArray()
    return all.sort((a, b) => a.customName.localeCompare(b.customName, undefined, { sensitivity: 'base' }))
  }

  async save(unit: OwnedUnit) {
    await this.db.units.put(unit)
  }

  async delete(id: string) {
    await this.db.transaction('rw', [this.db.units, this.db.statusEvents, this.db.photos, this.db.photoFiles, this.db.lists], async () => {
      const photoIds = (await this.db.photos.where('unitId').equals(id).primaryKeys()) as string[]
      // Lists keep the entry; it is matched by datasheet from now on.
      await this.db.lists
        .filter((l) => l.entries.some((e) => e.ownedUnitId === id))
        .modify((l) => {
          l.entries = l.entries.map((e) => {
            if (e.ownedUnitId !== id) return e
            const { ownedUnitId: _, ...rest } = e
            return rest
          })
        })
      await this.db.photoFiles.bulkDelete(photoIds)
      await this.db.photos.bulkDelete(photoIds)
      await this.db.statusEvents.where('unitId').equals(id).delete()
      await this.db.units.delete(id)
    })
  }

  async recordMove(unit: OwnedUnit, event: StatusEvent) {
    if (event.unitId !== unit.id) throw new Error('Event belongs to a different unit')
    await this.db.transaction('rw', this.db.units, this.db.statusEvents, async () => {
      await this.db.units.put(unit)
      await this.db.statusEvents.put(event)
    })
  }
}

export class DexieEventRepository implements EventRepository {
  private db: MiniTrackerDb
  constructor(db: MiniTrackerDb) {
    this.db = db
  }

  async listForUnit(unitId: string) {
    const events = await this.db.statusEvents.where('unitId').equals(unitId).toArray()
    return events.sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  }
}

// 'pipeline' is the original (v0.1) key of the painting pipeline; keep it so saved data still loads.
const storageKey = (key: PipelineKey) => (key === 'painting' ? 'pipeline' : `pipeline:${key}`)

export class DexieSettingsRepository implements SettingsRepository {
  private db: MiniTrackerDb
  constructor(db: MiniTrackerDb) {
    this.db = db
  }

  async getPipeline(key: PipelineKey = 'painting') {
    const row = await this.db.settings.get(storageKey(key))
    return (row?.value as Pipeline | undefined) ?? structuredClone(DEFAULT_PIPELINES[key])
  }

  async getValue<T>(key: string, fallback: T): Promise<T> {
    return ((await this.db.settings.get(key))?.value as T | undefined) ?? fallback
  }

  async setValue(key: string, value: unknown): Promise<void> {
    await this.db.settings.put({ key, value })
  }

  async savePipeline(pipeline: Pipeline, key: PipelineKey = 'painting') {
    validatePipeline(pipeline)
    await this.db.settings.put({ key: storageKey(key), value: pipeline })
  }
}

export class DexieCatalogueRepository {
  private db: MiniTrackerDb
  constructor(db: MiniTrackerDb) {
    this.db = db
  }

  /** All installed catalogues (e.g. 10th and 11th edition). */
  list(): Promise<Catalogue[]> {
    return this.db.catalogues.toArray()
  }

  /** Install or update one catalogue (keyed by game system id, so editions sit side by side). */
  async save(c: Catalogue): Promise<void> {
    await this.db.catalogues.put(c)
  }

  async remove(gameId: string): Promise<void> {
    await this.db.catalogues.delete(gameId)
  }
}

export class DexiePaintRepository {
  private db: MiniTrackerDb
  constructor(db: MiniTrackerDb) {
    this.db = db
  }

  listStock(): Promise<PaintStock[]> {
    return this.db.paintStock.toArray()
  }

  async saveStock(s: PaintStock): Promise<void> {
    await this.db.paintStock.put(s)
  }

  async deleteStock(paintId: string): Promise<void> {
    await this.db.paintStock.delete(paintId)
  }

  listCustom(): Promise<PaintDef[]> {
    return this.db.customPaints.toArray()
  }

  async saveCustom(p: PaintDef): Promise<void> {
    if (!p.custom) throw new Error('Only custom paints can be saved')
    await this.db.customPaints.put(p)
  }

  /** Deletes a custom paint and its stock. */
  async deleteCustom(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.customPaints, this.db.paintStock, async () => {
      await this.db.paintStock.delete(id)
      await this.db.customPaints.delete(id)
    })
  }
}

export class DexiePhotoRepository {
  private db: MiniTrackerDb
  constructor(db: MiniTrackerDb) {
    this.db = db
  }

  /** Saves metadata and image data together. Fails if the file name is already taken. */
  async add(photo: Photo, files: PhotoFiles): Promise<void> {
    if (photo.id !== files.id) throw new Error('Photo and files must share an id')
    await this.db.transaction('rw', this.db.photos, this.db.photoFiles, async () => {
      await this.db.photos.add(photo)
      await this.db.photoFiles.put(files)
    })
  }

  async listForUnit(unitId: string): Promise<Photo[]> {
    const list = await this.db.photos.where('unitId').equals(unitId).toArray()
    return list.sort((a, b) => a.takenAt.localeCompare(b.takenAt) || a.fileName.localeCompare(b.fileName))
  }

  async listForScheme(schemeId: string): Promise<Photo[]> {
    const list = await this.db.photos.where('schemeId').equals(schemeId).toArray()
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.fileName.localeCompare(b.fileName))
  }

  files(id: string): Promise<PhotoFiles | undefined> {
    return this.db.photoFiles.get(id)
  }

  async fileNameTaken(fileName: string): Promise<boolean> {
    return (await this.db.photos.where('fileName').equals(fileName).count()) > 0
  }

  async update(photo: Photo): Promise<void> {
    await this.db.photos.put(photo)
  }

  async delete(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.photos, this.db.photoFiles, async () => {
      await this.db.photoFiles.delete(id)
      await this.db.photos.delete(id)
    })
  }

  /** Deletes the originals (keeps the shown copies) to free space. Returns bytes freed. */
  async dropOriginals(): Promise<number> {
    let freed = 0
    await this.db.transaction('rw', this.db.photos, this.db.photoFiles, async () => {
      const withOriginal = (await this.db.photos.toArray()).filter((p) => p.hasOriginal)
      for (const p of withOriginal) {
        const f = await this.db.photoFiles.get(p.id)
        if (f) await this.db.photoFiles.put({ id: f.id, display: f.display })
        await this.db.photos.put({ ...p, hasOriginal: false })
        freed += p.originalBytes
      }
    })
    return freed
  }

  /** Total bytes stored, split by copy. */
  async usage(): Promise<{ photos: number; displayBytes: number; originalBytes: number }> {
    const all = await this.db.photos.toArray()
    return {
      photos: all.length,
      displayBytes: all.reduce((n, p) => n + p.displayBytes, 0),
      originalBytes: all.reduce((n, p) => n + (p.hasOriginal ? p.originalBytes : 0), 0),
    }
  }
}

export class DexieSchemeRepository {
  private db: MiniTrackerDb
  constructor(db: MiniTrackerDb) {
    this.db = db
  }

  async list(): Promise<PaintScheme[]> {
    return (await this.db.schemes.toArray()).sort((a, b) => a.name.localeCompare(b.name))
  }

  async save(s: PaintScheme): Promise<void> {
    validateScheme(s)
    await this.db.schemes.put(s)
  }

  async saveMany(list: PaintScheme[]): Promise<void> {
    list.forEach(validateScheme)
    await this.db.schemes.bulkPut(list)
  }

  /** Deletes a scheme and its photos; units using it are unlinked and variants lose their link. */
  async delete(id: string): Promise<void> {
    await this.db.transaction('rw', [this.db.schemes, this.db.units, this.db.photos, this.db.photoFiles], async () => {
      const photoIds = (await this.db.photos.where('schemeId').equals(id).primaryKeys()) as string[]
      await this.db.photoFiles.bulkDelete(photoIds)
      await this.db.photos.bulkDelete(photoIds)
      await this.db.schemes.delete(id)
      await this.db.schemes.where('basedOn').equals(id).modify((s) => {
        delete s.basedOn
      })
      await this.db.units.filter((u) => u.schemeId === id).modify((u) => {
        delete u.schemeId
      })
    })
  }
}

export class DexieListRepository {
  private db: MiniTrackerDb
  constructor(db: MiniTrackerDb) {
    this.db = db
  }

  async get(id: string): Promise<ArmyList | undefined> {
    return this.db.lists.get(id)
  }

  /** Most recently changed first. */
  async list(): Promise<ArmyList[]> {
    return (await this.db.lists.toArray()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name))
  }

  async save(l: ArmyList): Promise<void> {
    validateList(l)
    await this.db.lists.put(l)
  }

  async delete(id: string): Promise<void> {
    await this.db.lists.delete(id)
  }
}

export class DexieShoppingRepository {
  private db: MiniTrackerDb
  constructor(db: MiniTrackerDb) {
    this.db = db
  }

  async load(): Promise<{ items: ShopItem[]; lists: ShopList[] }> {
    const [items, lists] = await Promise.all([this.db.shopItems.toArray(), this.db.shopLists.toArray()])
    return { items, lists: lists.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name)) }
  }

  async saveItems(items: ShopItem[]): Promise<void> {
    await this.db.shopItems.bulkPut(items)
  }

  async deleteItem(id: string): Promise<void> {
    await this.db.shopItems.delete(id)
  }

  async saveList(l: ShopList): Promise<void> {
    await this.db.shopLists.put(l)
  }

  async deleteList(id: string): Promise<void> {
    await this.db.shopLists.delete(id)
  }
}
