import { create } from 'zustand'
import { exportBackup, importBackup, parseBackup } from '../data/backup'
import { MiniTrackerDb } from '../data/db'
import { convert } from '../data/catalogue/convert'
import { BSDATA_40K, downloadDataFiles, latestCommit } from '../data/catalogue/fetch'
import { DexieCatalogueRepository, DexieEventRepository, DexieSettingsRepository, DexieUnitRepository } from '../data/repositories/dexie'
import type { Catalogue } from '../domain/catalogue/types'
import { DEFAULT_PIPELINE, moveModels, type MoveOptions } from '../domain/collection/pipeline'
import type { Ctx, OwnedUnit, Pipeline, StageId, StatusEvent } from '../domain/collection/types'

const db = new MiniTrackerDb()
/** Exposed for tests only. */
export const appDb = db
const unitsRepo = new DexieUnitRepository(db)
const eventsRepo = new DexieEventRepository(db)
const settingsRepo = new DexieSettingsRepository(db)
const catalogueRepo = new DexieCatalogueRepository(db)

export interface CatalogueJob {
  phase: 'idle' | 'checking' | 'downloading' | 'converting'
  done: number
  total: number
  error?: string
}

export const ctx = (): Ctx => ({ now: new Date().toISOString(), newId: () => crypto.randomUUID() })

interface State {
  ready: boolean
  units: OwnedUnit[]
  pipeline: Pipeline
  /** History per unit id, loaded on demand. */
  events: Record<string, StatusEvent[]>
  catalogue: Catalogue | null
  catalogueJob: CatalogueJob
  load(): Promise<void>
  /** Download the latest BSData files and convert them on this device. */
  downloadCatalogue(): Promise<void>
  /** Latest BSData commit, to compare with the installed one. */
  latestCatalogueCommit(): Promise<string>
  /** Convert .gst/.cat files picked from disk (fallback when GitHub is unreachable). */
  importCatalogueFiles(files: File[]): Promise<void>
  removeCatalogue(): Promise<void>
  saveUnit(unit: OwnedUnit): Promise<void>
  deleteUnit(id: string): Promise<void>
  loadEvents(unitId: string): Promise<void>
  move(unit: OwnedUnit, groupId: string, count: number, to: StageId, opts: MoveOptions): Promise<void>
  savePipeline(p: Pipeline): Promise<void>
  /** JSON text of a full backup. */
  exportBackup(): Promise<string>
  /** Replace all data with a backup file's text, then reload. */
  importBackup(text: string): Promise<void>
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  units: [],
  pipeline: DEFAULT_PIPELINE,
  events: {},
  catalogue: null,
  catalogueJob: { phase: 'idle', done: 0, total: 0 },

  async load() {
    const [units, pipeline, catalogue] = await Promise.all([unitsRepo.list(), settingsRepo.getPipeline(), catalogueRepo.current()])
    set({ units, pipeline, catalogue: catalogue ?? null, ready: true })
  },

  async downloadCatalogue() {
    const job = (j: Partial<CatalogueJob>) => set({ catalogueJob: { ...get().catalogueJob, ...j } })
    try {
      job({ phase: 'checking', done: 0, total: 0, error: undefined })
      const commit = await latestCommit(BSDATA_40K.repo)
      job({ phase: 'downloading' })
      const files = await downloadDataFiles(BSDATA_40K.repo, commit, (done, total) => job({ done, total }))
      job({ phase: 'converting' })
      const catalogue = await convert(files, { repo: BSDATA_40K.repo, commit, fetchedAt: new Date().toISOString() })
      await catalogueRepo.replace(catalogue)
      set({ catalogue })
      job({ phase: 'idle' })
    } catch (e) {
      job({ phase: 'idle', error: (e as Error).message })
    }
  },

  latestCatalogueCommit() {
    return latestCommit(BSDATA_40K.repo)
  },

  async importCatalogueFiles(picked) {
    const job = (j: Partial<CatalogueJob>) => set({ catalogueJob: { ...get().catalogueJob, ...j } })
    try {
      job({ phase: 'converting', error: undefined })
      const files = await Promise.all(picked.map(async (f) => ({ name: f.name, text: await f.text() })))
      const catalogue = await convert(files, { repo: 'local files', commit: 'local', fetchedAt: new Date().toISOString() })
      await catalogueRepo.replace(catalogue)
      set({ catalogue })
      job({ phase: 'idle' })
    } catch (e) {
      job({ phase: 'idle', error: (e as Error).message })
    }
  },

  async removeCatalogue() {
    await catalogueRepo.clear()
    set({ catalogue: null })
  },

  async saveUnit(unit) {
    await unitsRepo.save(unit)
    set({ units: await unitsRepo.list() })
  },

  async deleteUnit(id) {
    await unitsRepo.delete(id)
    const events = { ...get().events }
    delete events[id]
    set({ units: await unitsRepo.list(), events })
  },

  async loadEvents(unitId) {
    const list = await eventsRepo.listForUnit(unitId)
    set({ events: { ...get().events, [unitId]: list } })
  },

  async move(unit, groupId, count, to, opts) {
    const { unit: updated, event } = moveModels(unit, groupId, count, to, get().pipeline, ctx(), opts)
    await unitsRepo.recordMove(updated, event)
    set({ units: await unitsRepo.list() })
    await get().loadEvents(unit.id)
  },

  async savePipeline(p) {
    await settingsRepo.savePipeline(p)
    set({ pipeline: p })
  },

  async exportBackup() {
    return JSON.stringify(await exportBackup(db, new Date().toISOString()), null, 2)
  },

  async importBackup(text) {
    await importBackup(db, parseBackup(text))
    set({ events: {} })
    await get().load()
  },
}))
