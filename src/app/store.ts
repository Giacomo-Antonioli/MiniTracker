import { create } from 'zustand'
import { exportBackup, importBackup, parseBackup } from '../data/backup'
import { MiniTrackerDb } from '../data/db'
import { convert } from '../data/catalogue/convert'
import { BSDATA_40K, downloadDataFiles, latestCommit } from '../data/catalogue/fetch'
import { DexieCatalogueRepository, DexieEventRepository, DexiePaintRepository, DexieSettingsRepository, DexieUnitRepository } from '../data/repositories/dexie'
import { inventoryFromCsv } from '../domain/paints/csv'
import type { PaintDef, PaintStock } from '../domain/paints/types'
import type { Catalogue } from '../domain/catalogue/types'
import { DEFAULT_PIPELINES, type PipelineKey } from '../domain/pipelines'
import { DEFAULT_PIPELINE, moveModels, type MoveOptions } from '../domain/collection/pipeline'
import type { Ctx, OwnedUnit, Pipeline, StageId, StatusEvent } from '../domain/collection/types'

const db = new MiniTrackerDb()
/** Exposed for tests only. */
export const appDb = db
const unitsRepo = new DexieUnitRepository(db)
const eventsRepo = new DexieEventRepository(db)
const settingsRepo = new DexieSettingsRepository(db)
const catalogueRepo = new DexieCatalogueRepository(db)
const paintRepo = new DexiePaintRepository(db)

/** The bundled paint list is ~200 KB, so it is loaded only when needed. */
async function loadSeedPaints(): Promise<PaintDef[]> {
  const mod = await import('../data/paints/seed.json')
  return (mod.default as { paints: PaintDef[] }).paints
}

export interface CatalogueJob {
  phase: 'idle' | 'checking' | 'downloading' | 'converting'
  done: number
  total: number
  error?: string
}

export const THEMES = { grimdark: 'Grimdark', forum2005: 'Forum 2005' } as const
export type Theme = keyof typeof THEMES

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('theme')
    return t && t in THEMES ? (t as Theme) : 'grimdark'
  } catch {
    return 'grimdark'
  }
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
  /** All editable pipelines; `pipeline` above is the same as pipelines.painting. */
  pipelines: Record<PipelineKey, Pipeline>
  savePipelineFor(key: PipelineKey, p: Pipeline): Promise<void>
  theme: Theme
  setTheme(theme: Theme): void
  /** Bundled + custom paints; empty until loadPaints() ran. */
  paints: PaintDef[]
  paintStock: Map<string, PaintStock>
  loadPaints(): Promise<void>
  saveStock(s: PaintStock): Promise<void>
  removeStock(paintId: string): Promise<void>
  saveCustomPaint(p: PaintDef): Promise<void>
  deleteCustomPaint(id: string): Promise<void>
  /** Import an inventory CSV; returns what happened. */
  importPaintCsv(text: string): Promise<{ imported: number; created: number; skipped: { line: number; reason: string }[] }>
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
  pipelines: DEFAULT_PIPELINES,
  theme: readTheme(),
  paints: [],
  paintStock: new Map(),

  async loadPaints() {
    const [seed, custom] = await Promise.all([loadSeedPaints(), paintRepo.listCustom()])
    const paints = [...seed, ...custom].sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))
    set({ paints })
  },

  async saveStock(stock) {
    await paintRepo.saveStock(stock)
    set({ paintStock: new Map(get().paintStock).set(stock.paintId, stock) })
  },

  async removeStock(paintId) {
    await paintRepo.deleteStock(paintId)
    const m = new Map(get().paintStock)
    m.delete(paintId)
    set({ paintStock: m })
  },

  async saveCustomPaint(paint) {
    await paintRepo.saveCustom(paint)
    const others = get().paints.filter((p) => p.id !== paint.id)
    set({ paints: [...others, paint].sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name)) })
  },

  async importPaintCsv(text) {
    if (!get().paints.length) await get().loadPaints()
    const stages = get().pipelines.paint.stages
    const r = inventoryFromCsv(text, get().paints, stages.some((x) => x.id === 'sealed') ? 'sealed' : stages[0].id, ctx())
    for (const p of r.newPaints) await get().saveCustomPaint(p)
    for (const st of r.stocks) await get().saveStock(st)
    return { imported: r.stocks.length, created: r.newPaints.length, skipped: r.skipped }
  },

  async deleteCustomPaint(id) {
    await paintRepo.deleteCustom(id)
    const m = new Map(get().paintStock)
    m.delete(id)
    set({ paints: get().paints.filter((p) => p.id !== id), paintStock: m })
  },

  setTheme(theme) {
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* storage unavailable: theme just isn't remembered */
    }
    set({ theme })
  },

  async load() {
    const [units, painting, paint, scheme, catalogue, stock] = await Promise.all([
      unitsRepo.list(),
      settingsRepo.getPipeline('painting'),
      settingsRepo.getPipeline('paint'),
      settingsRepo.getPipeline('scheme'),
      catalogueRepo.current(),
      paintRepo.listStock(),
    ])
    set({
      units,
      pipeline: painting,
      pipelines: { painting, paint, scheme },
      catalogue: catalogue ?? null,
      paintStock: new Map(stock.map((s) => [s.paintId, s])),
      ready: true,
    })
    if (get().paints.length) await get().loadPaints()
  },

  async savePipelineFor(key, p) {
    await settingsRepo.savePipeline(p, key)
    set({ pipelines: { ...get().pipelines, [key]: p }, ...(key === 'painting' ? { pipeline: p } : {}) })
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

  savePipeline(p) {
    return get().savePipelineFor('painting', p)
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
