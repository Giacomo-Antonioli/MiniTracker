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
    await this.db.transaction('rw', [this.db.units, this.db.statusEvents, this.db.photos, this.db.photoFiles], async () => {
      const photoIds = (await this.db.photos.where('unitId').equals(id).primaryKeys()) as string[]
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

  /** The installed catalogue (one game for now). */
  async current(): Promise<Catalogue | undefined> {
    return (await this.db.catalogues.toArray())[0]
  }

  async replace(c: Catalogue): Promise<void> {
    await this.db.transaction('rw', this.db.catalogues, async () => {
      await this.db.catalogues.clear()
      await this.db.catalogues.put(c)
    })
  }

  async clear(): Promise<void> {
    await this.db.catalogues.clear()
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
