import { create } from 'zustand'
import { exportBackupZip, importBackupFile } from '../data/backup'
import { MiniTrackerDb } from '../data/db'
import { convert } from '../data/catalogue/convert'
import { BSDATA_40K, downloadDataFiles, latestCommit } from '../data/catalogue/fetch'
import { extensionOf, makeDisplayCopy } from '../data/photos/compress'
import { DexieCatalogueRepository, DexieEventRepository, DexiePaintRepository, DexiePhotoRepository, DexieSchemeRepository, DexieSettingsRepository, DexieUnitRepository } from '../data/repositories/dexie'
import { parseSchemeFile } from '../domain/schemes/scheme'
import type { PaintScheme } from '../domain/schemes/types'
import { photoFileName } from '../domain/photos/naming'
import type { Photo, PhotoOwner } from '../domain/photos/types'
import { inventoryFromCsv } from '../domain/paints/csv'
import type { PaintDef, PaintStock } from '../domain/paints/types'
import type { Catalogue } from '../domain/catalogue/types'
import type { BacklogFilter } from '../domain/collection/backlog'
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
const photoRepo = new DexiePhotoRepository(db)
const schemeRepo = new DexieSchemeRepository(db)

/** Bundled community/official schemes (scraped facts + credit), loaded on demand. */
async function loadLibraryFile(): Promise<{ schemes: PaintScheme[]; paints: PaintDef[] }> {
  const mod = await import('../data/schemes/library.json')
  return mod.default as unknown as { schemes: PaintScheme[]; paints: PaintDef[] }
}

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
  /** Move models; an optional photo file is attached to the history step. */
  move(unit: OwnedUnit, groupId: string, count: number, to: StageId, opts: MoveOptions, photo?: File): Promise<void>
  /** Photos per unit id (unit gallery + history photos), loaded on demand. */
  photos: Record<string, Photo[]>
  /** Backlog filters, kept while you visit other pages. */
  backlogFilter: BacklogFilter
  setBacklogFilter(f: BacklogFilter): void
  loadPhotos(unitId: string): Promise<void>
  addPhotos(unit: OwnedUnit, files: File[], opts?: { owner?: PhotoOwner; stage?: string; id?: string }): Promise<Photo[]>
  /** Photos of a scheme (cover, gallery, steps), stored under photos[schemeId]. */
  loadSchemePhotos(schemeId: string): Promise<void>
  addSchemePhotos(scheme: PaintScheme, files: File[], stepId?: string): Promise<Photo[]>
  photoFiles(id: string): ReturnType<DexiePhotoRepository['files']>
  updatePhoto(photo: Photo): Promise<void>
  deletePhoto(photo: Photo): Promise<void>
  photoUsage(): ReturnType<DexiePhotoRepository['usage']>
  schemes: PaintScheme[]
  /** Read-only schemes bundled with the app (ids start with "lib/"). */
  library: PaintScheme[]
  loadLibrary(): Promise<void>
  /** Default scheme per faction name. */
  schemeDefaults: Record<string, string>
  saveScheme(s: PaintScheme): Promise<void>
  deleteScheme(id: string): Promise<void>
  setDefaultScheme(faction: string, schemeId: string | undefined): Promise<void>
  /** Links pasted in "Add from link", kept so you can come back to them. */
  recipeLinks: { url: string; title?: string; addedAt: string; schemeId?: string }[]
  rememberLink(link: { url: string; title?: string; schemeId?: string }): Promise<void>
  forgetLink(url: string): Promise<void>
  /** Import a shared scheme file; returns the new schemes. */
  importSchemes(text: string): Promise<PaintScheme[]>
  savePipeline(p: Pipeline): Promise<void>
  /** Backup zip; originals included only when asked. */
  exportBackup(includeOriginals: boolean): Promise<Blob>
  /** Replace all data with a backup file (zip or older JSON), then reload. Returns the unit and photo counts. */
  importBackup(file: Blob): Promise<{ units: number; photos: number; exportedAt: string }>
  /** Free space by deleting photo originals. Returns bytes freed. */
  dropOriginals(): Promise<number>
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
    const [seed, custom, lib] = await Promise.all([loadSeedPaints(), paintRepo.listCustom(), loadLibraryFile()])
    const known = new Set([...seed, ...custom].map((p) => p.id))
    const paints = [...seed, ...custom, ...lib.paints.filter((p) => !known.has(p.id))].sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))
    set({ paints })
  },

  library: [],

  async loadLibrary() {
    if (get().library.length) return
    set({ library: (await loadLibraryFile()).schemes })
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
    const [units, painting, paint, scheme, catalogue, stock, schemes, schemeDefaults, recipeLinks] = await Promise.all([
      unitsRepo.list(),
      settingsRepo.getPipeline('painting'),
      settingsRepo.getPipeline('paint'),
      settingsRepo.getPipeline('scheme'),
      catalogueRepo.current(),
      paintRepo.listStock(),
      schemeRepo.list(),
      settingsRepo.getValue<Record<string, string>>('schemeDefaults', {}),
      settingsRepo.getValue<State['recipeLinks']>('recipeLinks', []),
    ])
    set({
      units,
      pipeline: painting,
      pipelines: { painting, paint, scheme },
      catalogue: catalogue ?? null,
      paintStock: new Map(stock.map((s) => [s.paintId, s])),
      schemes,
      schemeDefaults,
      recipeLinks,
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
    const photos = { ...get().photos }
    delete photos[id]
    set({ units: await unitsRepo.list(), events, photos })
  },

  async loadEvents(unitId) {
    const list = await eventsRepo.listForUnit(unitId)
    set({ events: { ...get().events, [unitId]: list } })
  },

  async move(unit, groupId, count, to, opts, photo) {
    const photoId = photo ? crypto.randomUUID() : undefined
    const { unit: updated, event } = moveModels(unit, groupId, count, to, get().pipeline, ctx(), { ...opts, photoId })
    await unitsRepo.recordMove(updated, event)
    if (photo) await get().addPhotos(updated, [photo], { owner: { kind: 'event', unitId: unit.id, eventId: event.id }, stage: to, id: photoId })
    set({ units: await unitsRepo.list() })
    await get().loadEvents(unit.id)
  },

  photos: {},
  backlogFilter: {},
  setBacklogFilter(f) {
    set({ backlogFilter: f })
  },

  async loadPhotos(unitId) {
    set({ photos: { ...get().photos, [unitId]: await photoRepo.listForUnit(unitId) } })
  },

  async addPhotos(unit, files, opts = {}) {
    const added: Photo[] = []
    const stage = opts.stage ?? unit.groups[0]?.status
    for (const file of files) {
      const display = await makeDisplayCopy(file)
      const now = new Date().toISOString()
      const takenAt = file.lastModified ? new Date(file.lastModified).toISOString() : now
      // Next free sequence number for this unit/stage/day.
      let seq = 1
      let fileName = ''
      do {
        fileName = photoFileName({ faction: unit.factionName, unitName: unit.customName, unitId: unit.id, stage, date: now, seq: seq++, ext: extensionOf(file) })
      } while (await photoRepo.fileNameTaken(fileName))
      const id = (added.length === 0 && opts.id) || crypto.randomUUID()
      const photo: Photo = {
        id,
        owner: opts.owner ?? { kind: 'unit', unitId: unit.id },
        unitId: unit.id,
        fileName,
        caption: '',
        takenAt,
        createdAt: now,
        width: display.width,
        height: display.height,
        originalType: file.type || 'application/octet-stream',
        originalBytes: file.size,
        displayBytes: display.blob.size,
        hasOriginal: true,
      }
      await photoRepo.add(photo, { id, display: display.blob, original: file })
      added.push(photo)
    }
    await get().loadPhotos(unit.id)
    return added
  },

  async loadSchemePhotos(schemeId) {
    set({ photos: { ...get().photos, [schemeId]: await photoRepo.listForScheme(schemeId) } })
  },

  async addSchemePhotos(scheme, files, stepId) {
    const added: Photo[] = []
    for (const file of files) {
      const display = await makeDisplayCopy(file)
      const now = new Date().toISOString()
      let seq = 1
      let fileName = ''
      do {
        fileName = photoFileName({ scheme: scheme.name, schemeId: scheme.id, date: now, seq: seq++, ext: extensionOf(file) })
      } while (await photoRepo.fileNameTaken(fileName))
      const id = crypto.randomUUID()
      const photo: Photo = {
        id,
        owner: { kind: 'scheme', schemeId: scheme.id, ...(stepId ? { stepId } : {}) },
        schemeId: scheme.id,
        fileName,
        caption: '',
        takenAt: file.lastModified ? new Date(file.lastModified).toISOString() : now,
        createdAt: now,
        width: display.width,
        height: display.height,
        originalType: file.type || 'application/octet-stream',
        originalBytes: file.size,
        displayBytes: display.blob.size,
        hasOriginal: true,
      }
      await photoRepo.add(photo, { id, display: display.blob, original: file })
      added.push(photo)
    }
    await get().loadSchemePhotos(scheme.id)
    return added
  },

  photoFiles(id) {
    return photoRepo.files(id)
  },

  async updatePhoto(photo) {
    await photoRepo.update(photo)
    if (photo.unitId) await get().loadPhotos(photo.unitId)
    if (photo.schemeId) await get().loadSchemePhotos(photo.schemeId)
  },

  async deletePhoto(photo) {
    await photoRepo.delete(photo.id)
    if (photo.unitId) await get().loadPhotos(photo.unitId)
    if (photo.schemeId) {
      await get().loadSchemePhotos(photo.schemeId)
      const s = get().schemes.find((x) => x.id === photo.schemeId)
      if (s?.coverPhotoId === photo.id) await get().saveScheme({ ...s, coverPhotoId: undefined })
    }
  },

  photoUsage() {
    return photoRepo.usage()
  },

  schemes: [],
  schemeDefaults: {},

  async saveScheme(scheme) {
    await schemeRepo.save(scheme)
    set({ schemes: await schemeRepo.list() })
  },

  async deleteScheme(id) {
    await schemeRepo.delete(id)
    const defaults = Object.fromEntries(Object.entries(get().schemeDefaults).filter(([, v]) => v !== id))
    await settingsRepo.setValue('schemeDefaults', defaults)
    set({ schemes: await schemeRepo.list(), units: await unitsRepo.list(), schemeDefaults: defaults })
  },

  async setDefaultScheme(faction, schemeId) {
    const defaults = { ...get().schemeDefaults }
    if (schemeId) defaults[faction] = schemeId
    else delete defaults[faction]
    await settingsRepo.setValue('schemeDefaults', defaults)
    set({ schemeDefaults: defaults })
  },

  recipeLinks: [],

  async rememberLink(link) {
    const others = get().recipeLinks.filter((l) => l.url !== link.url)
    const prev = get().recipeLinks.find((l) => l.url === link.url)
    const links = [{ ...prev, ...link, addedAt: prev?.addedAt ?? new Date().toISOString() }, ...others]
    await settingsRepo.setValue('recipeLinks', links)
    set({ recipeLinks: links })
  },

  async forgetLink(url) {
    const links = get().recipeLinks.filter((l) => l.url !== url)
    await settingsRepo.setValue('recipeLinks', links)
    set({ recipeLinks: links })
  },

  async importSchemes(text) {
    const { schemes, paints } = parseSchemeFile(text, ctx())
    if (!get().paints.length) await get().loadPaints()
    const known = new Set(get().paints.map((p) => p.id))
    // A friend's custom paints come along so the recipe still shows names and colours.
    for (const p of paints) if (!known.has(p.id) && p.custom) await get().saveCustomPaint(p)
    await schemeRepo.saveMany(schemes)
    set({ schemes: await schemeRepo.list() })
    return schemes
  },

  savePipeline(p) {
    return get().savePipelineFor('painting', p)
  },

  exportBackup(includeOriginals) {
    return exportBackupZip(db, new Date().toISOString(), includeOriginals)
  },

  async importBackup(file) {
    const b = await importBackupFile(db, file)
    set({ events: {}, photos: {} })
    await get().load()
    return { units: b.data.units.length, photos: b.data.photos?.length ?? 0, exportedAt: b.exportedAt }
  },

  async dropOriginals() {
    const freed = await photoRepo.dropOriginals()
    set({ photos: {} })
    return freed
  },
}))
