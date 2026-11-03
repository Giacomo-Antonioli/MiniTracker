import { create } from 'zustand'
import { exportBackupZip, importBackupFile } from '../data/backup'
import { MiniTrackerDb } from '../data/db'
import { convert } from '../data/catalogue/convert'
import { CURRENT_EDITION, downloadDataFiles, editionOfRepo, latestCommit } from '../data/catalogue/fetch'
import { extensionOf, makeDisplayCopy } from '../data/photos/compress'
import { DexieCatalogueRepository, DexieEventRepository, DexieListRepository, DexiePaintRepository, DexiePhotoRepository, DexieSchemeRepository, DexieSettingsRepository, DexieShoppingRepository, DexieUnitRepository } from '../data/repositories/dexie'
import { parseSchemeFile } from '../domain/schemes/scheme'
import type { PaintScheme } from '../domain/schemes/types'
import { photoFileName } from '../domain/photos/naming'
import type { Photo, PhotoOwner } from '../domain/photos/types'
import { inventoryFromCsv } from '../domain/paints/csv'
import { newStock } from '../domain/paints/inventory'
import type { PaintDef, PaintStock } from '../domain/paints/types'
import type { Catalogue } from '../domain/catalogue/types'
import { DEFAULT_LAYOUT, parseLayout, type CardLayout } from '../domain/home/layout'
import { parseGames, type Game } from '../domain/games/games'
import { parseWahapedia, type StratagemData } from '../domain/stratagems/stratagems'
import { parseGoals, type Goal } from '../domain/goals/goals'
import { parseTicks, toggleTick as flipTick, clearTicks, type CompanionMode, type Ticks } from '../domain/companion/companion'
import { parseStorage, pruneStorage, EMPTY_STORAGE, type Storage } from '../domain/storage/storage'
import { parseSessions, parseTimers, pruneTimers, stopTimer as endTimer, type PaintSession, type PaintTimer } from '../domain/paintTime/paintTime'
import { parsePurchases, type Purchase } from '../domain/costs/costs'
import { becameLow, lowPaints, parseSupplies, supplyItem, type Supply } from '../domain/supplies/supplies'
import type { ArmyList, EditionKey } from '../domain/lists/types'
import { addItems, newList, syncWishlisted, withoutList } from '../domain/shopping/shopping'
import type { NewShopItem, ShopItem, ShopList } from '../domain/shopping/types'
import type { BacklogFilter } from '../domain/collection/backlog'
import { DEFAULT_PIPELINES, type PipelineKey } from '../domain/pipelines'
import { DEFAULT_PIPELINE, firstOwnedStage, moveModels, WISHLISTED, type MoveOptions } from '../domain/collection/pipeline'
import { createUnit, mergeGroups } from '../domain/collection/ownedUnit'
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
const listRepo = new DexieListRepository(db)
const shopRepo = new DexieShoppingRepository(db)

/** Installed catalogue of an edition (by its BSData repo); undefined when that edition is not installed. */
export function catalogueFor(catalogues: Catalogue[], edition: EditionKey): Catalogue | undefined {
  return catalogues.find((c) => editionOfRepo(c.source.repo)?.key === edition)
}

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
  /** Repo being downloaded (so the right edition card shows progress). */
  repo?: string
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

/** Page shown when the app opens. */
export type StartPage = 'home' | 'backlog'
export function readStartPage(): StartPage {
  try {
    return localStorage.getItem('startPage') === 'backlog' ? 'backlog' : 'home'
  } catch {
    return 'home'
  }
}
export function saveStartPage(p: StartPage) {
  try {
    localStorage.setItem('startPage', p)
  } catch {
    // Not saved: the default (Home) is used.
  }
}

/** How rule explanations show: closed until the arrow is clicked, always open, or open on hover. */
export type RuleDisplay = 'collapsed' | 'expanded' | 'hover'
function readRuleDisplay(): RuleDisplay {
  try {
    const v = localStorage.getItem('ruleDisplay')
    return v === 'expanded' || v === 'hover' ? v : 'collapsed'
  } catch {
    return 'collapsed'
  }
}

export const ctx = (): Ctx => ({ now: new Date().toISOString(), newId: () => crypto.randomUUID() })

interface State {
  ready: boolean
  units: OwnedUnit[]
  pipeline: Pipeline
  /** History per unit id, loaded on demand. */
  events: Record<string, StatusEvent[]>
  /** The active catalogue (edition) used by the picker, browser, rules and lists. */
  catalogue: Catalogue | null
  /** Every installed catalogue (e.g. 10th and 11th edition). */
  catalogues: Catalogue[]
  setActiveCatalogue(gameId: string): Promise<void>
  catalogueJob: CatalogueJob
  /** All editable pipelines; `pipeline` above is the same as pipelines.painting. */
  pipelines: Record<PipelineKey, Pipeline>
  savePipelineFor(key: PipelineKey, p: Pipeline): Promise<void>
  theme: Theme
  setTheme(theme: Theme): void
  ruleDisplay: RuleDisplay
  setRuleDisplay(v: RuleDisplay): void
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
  /** Download the latest BSData files of a repo (default: current edition) and convert them on this device. */
  downloadCatalogue(repo?: string): Promise<void>
  /** Latest BSData commit of a repo, to compare with the installed one. */
  latestCatalogueCommit(repo: string): Promise<string>
  /** Convert .gst/.cat files picked from disk (fallback when GitHub is unreachable). */
  importCatalogueFiles(files: File[]): Promise<void>
  removeCatalogue(gameId: string): Promise<void>
  saveUnit(unit: OwnedUnit): Promise<void>
  deleteUnit(id: string): Promise<void>
  loadEvents(unitId: string): Promise<void>
  /** Every move of every unit, for stats. */
  allEvents(): Promise<StatusEvent[]>
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
  /** Stratagems and detachment rules imported from Wahapedia (#98); null until imported. */
  stratagemData: StratagemData | null
  importStratagems(files: File[]): Promise<void>
  removeStratagems(): Promise<void>
  /** Hobby supplies with low-stock alerts (#92); saved in the backup. */
  supplies: Supply[]
  /** Boxes/orders covering several units (#94); saved in the backup. */
  purchases: Purchase[]
  /** Hobby goals (#90); saved in the backup. */
  goals: Goal[]
  saveGoal(g: Goal): Promise<void>
  deleteGoal(id: string): Promise<void>
  /** Painting time (#89): logged sessions and running or paused timers; saved in the backup. */
  paintSessions: PaintSession[]
  paintTimers: PaintTimer[]
  saveSession(s: PaintSession): Promise<void>
  deleteSession(id: string): Promise<void>
  saveTimer(t: PaintTimer): Promise<void>
  deleteTimer(id: string): Promise<void>
  /** Stops a timer and logs its time as sessions split over its groups. */
  stopTimer(id: string): Promise<void>
  /** Storage places, unit homes and check-outs (#18); saved in the backup. */
  storage: Storage
  saveStorage(s: Storage): Promise<void>
  /** Open painter/builder companion, if any (not saved). */
  companion: { mode: CompanionMode; unitId: string; timerId?: string } | null
  openCompanion(mode: CompanionMode, unitId: string, timerId?: string): void
  closeCompanion(): void
  /** Companion checklist ticks per unit; saved in the backup. */
  companionTicks: Ticks
  toggleTick(unitId: string, key: string): Promise<void>
  clearTicks(unitId: string, prefix: string): Promise<void>
  savePurchase(p: Purchase): Promise<void>
  deletePurchase(id: string): Promise<void>
  /** Currency symbol for prices, e.g. €. */
  currency: string
  setCurrency(c: string): Promise<void>
  saveSupply(s: Supply): Promise<void>
  deleteSupply(id: string): Promise<void>
  /** Games, live and finished (#71); saved in the backup. */
  games: Game[]
  saveGame(g: Game): Promise<void>
  deleteGame(id: string): Promise<void>
  /** Cards on Home, in order, with sizes (saved in the backup). */
  homeLayout: CardLayout[]
  saveHomeLayout(l: CardLayout[]): Promise<void>
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
  /** Army lists, most recently changed first. */
  lists: ArmyList[]
  saveList(l: ArmyList): Promise<void>
  deleteList(id: string): Promise<void>
  /** Shopping (#87): every item is on the main list; named lists hold some of them. */
  shopItems: ShopItem[]
  shopLists: ShopList[]
  /** Add items to the main list and the given lists; `newListName` first creates a list and adds to it too. */
  addToShopping(items: NewShopItem[], listIds: string[], newListName?: string): Promise<void>
  saveShopItem(item: ShopItem): Promise<void>
  deleteShopItem(id: string): Promise<void>
  /** Tick an item bought (or not). A bought paint goes to the inventory as 'ordered', or 'owned' (a sealed pot more). */
  setBought(id: string, bought: boolean, paint?: 'ordered' | 'owned'): Promise<void>
  /**
   * Add a catalogue unit or paint you don't own yet. A unit also goes to the backlog as Wishlisted: a new entry,
   * more models on an existing one (`unitId`), or nothing (`backlog: 'none'`). A paint not in the inventory goes on the wishlist.
   */
  addFromCatalogue(item: NewShopItem, listIds: string[], backlog?: 'new' | 'none' | { unitId: string }): Promise<void>
  createShopList(name: string): Promise<ShopList>
  renameShopList(id: string, name: string): Promise<void>
  /** Delete a named list; its items stay on the main list. */
  deleteShopList(id: string): Promise<void>
}

/** Save a catalogue and keep the in-memory list in sync; the first one installed becomes active. */
async function installCatalogue(c: Catalogue) {
  await catalogueRepo.save(c)
  const { catalogues, catalogue } = useStore.getState()
  const next = [...catalogues.filter((x) => x.gameId !== c.gameId), c]
  const active = !catalogue || catalogue.gameId === c.gameId ? c : catalogue
  useStore.setState({ catalogues: next, catalogue: active })
  await settingsRepo.setValue('activeCatalogue', active.gameId)
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  units: [],
  pipeline: DEFAULT_PIPELINE,
  events: {},
  catalogue: null,
  catalogues: [],
  catalogueJob: { phase: 'idle', done: 0, total: 0, repo: undefined },

  async setActiveCatalogue(gameId) {
    await settingsRepo.setValue('activeCatalogue', gameId)
    set({ catalogue: get().catalogues.find((c) => c.gameId === gameId) ?? null })
  },
  pipelines: DEFAULT_PIPELINES,
  theme: readTheme(),
  ruleDisplay: readRuleDisplay(),
  setRuleDisplay(v) {
    try {
      localStorage.setItem('ruleDisplay', v)
    } catch {
      /* not remembered */
    }
    set({ ruleDisplay: v })
  },
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
    const before = get().paintStock.get(stock.paintId)
    await paintRepo.saveStock(stock)
    set({ paintStock: new Map(get().paintStock).set(stock.paintId, stock) })
    // Marking a paint "Running low" puts it on the shopping list (#92).
    if (stock.stage === 'low' && before?.stage !== 'low') await get().addToShopping(lowPaints(new Map([[stock.paintId, stock]]), get().paints), [])
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
    const [units, painting, paint, scheme, catalogues, stock, schemes, schemeDefaults, recipeLinks, activeCatalogue, lists, shopping, homeLayout, games, stratagemData, supplies, purchases, currency, goals, paintSessions, paintTimers, companionTicks, storage] = await Promise.all([
      unitsRepo.list(),
      settingsRepo.getPipeline('painting'),
      settingsRepo.getPipeline('paint'),
      settingsRepo.getPipeline('scheme'),
      catalogueRepo.list(),
      paintRepo.listStock(),
      schemeRepo.list(),
      settingsRepo.getValue<Record<string, string>>('schemeDefaults', {}),
      settingsRepo.getValue<State['recipeLinks']>('recipeLinks', []),
      settingsRepo.getValue<string | null>('activeCatalogue', null),
      listRepo.list(),
      shopRepo.load(),
      settingsRepo.getValue<CardLayout[] | null>('homeLayout', null),
      settingsRepo.getValue<unknown>('games', []),
      settingsRepo.getValue<StratagemData | null>('stratagems', null),
      settingsRepo.getValue<unknown>('supplies', []),
      settingsRepo.getValue<unknown>('purchases', []),
      settingsRepo.getValue<string>('currency', '€'),
      settingsRepo.getValue<unknown>('goals', []),
      settingsRepo.getValue<unknown>('paintSessions', []),
      settingsRepo.getValue<unknown>('paintTimers', []),
      settingsRepo.getValue<unknown>('companionTicks', {}),
      settingsRepo.getValue<unknown>('storage', null),
    ])
    const catalogue = catalogues.find((c) => c.gameId === activeCatalogue) ?? catalogues[0]
    set({
      units,
      pipeline: painting,
      pipelines: { painting, paint, scheme },
      catalogue: catalogue ?? null,
      catalogues,
      paintStock: new Map(stock.map((s) => [s.paintId, s])),
      schemes,
      schemeDefaults,
      recipeLinks,
      lists,
      shopItems: shopping.items,
      shopLists: shopping.lists,
      homeLayout: homeLayout ? parseLayout(JSON.stringify(homeLayout)) : DEFAULT_LAYOUT,
      games: parseGames(games),
      stratagemData,
      supplies: parseSupplies(supplies),
      purchases: parsePurchases(purchases),
      goals: parseGoals(goals),
      paintSessions: parseSessions(paintSessions),
      paintTimers: pruneTimers(parseTimers(paintTimers), units),
      companionTicks: parseTicks(companionTicks),
      storage: pruneStorage(parseStorage(storage), new Set(units.map((u) => u.id))),
      currency: typeof currency === 'string' && currency ? currency : '€',
      ready: true,
    })
    if (get().paints.length) await get().loadPaints()
  },

  async savePipelineFor(key, p) {
    await settingsRepo.savePipeline(p, key)
    set({ pipelines: { ...get().pipelines, [key]: p }, ...(key === 'painting' ? { pipeline: p } : {}) })
  },

  async downloadCatalogue(repo = CURRENT_EDITION.repo) {
    const job = (j: Partial<CatalogueJob>) => set({ catalogueJob: { ...get().catalogueJob, ...j } })
    try {
      job({ phase: 'checking', done: 0, total: 0, error: undefined, repo })
      const commit = await latestCommit(repo)
      job({ phase: 'downloading' })
      const files = await downloadDataFiles(repo, commit, (done, total) => job({ done, total }))
      job({ phase: 'converting' })
      const catalogue = await convert(files, { repo, commit, fetchedAt: new Date().toISOString() })
      await installCatalogue(catalogue)
      job({ phase: 'idle' })
    } catch (e) {
      job({ phase: 'idle', error: (e as Error).message })
    }
  },

  latestCatalogueCommit(repo) {
    return latestCommit(repo)
  },

  async importCatalogueFiles(picked) {
    const job = (j: Partial<CatalogueJob>) => set({ catalogueJob: { ...get().catalogueJob, ...j } })
    try {
      job({ phase: 'converting', error: undefined, repo: 'local files' })
      const files = await Promise.all(picked.map(async (f) => ({ name: f.name, text: await f.text() })))
      const catalogue = await convert(files, { repo: 'local files', commit: 'local', fetchedAt: new Date().toISOString() })
      await installCatalogue(catalogue)
      job({ phase: 'idle' })
    } catch (e) {
      job({ phase: 'idle', error: (e as Error).message })
    }
  },

  async removeCatalogue(gameId) {
    await catalogueRepo.remove(gameId)
    const catalogues = get().catalogues.filter((c) => c.gameId !== gameId)
    const catalogue = get().catalogue?.gameId === gameId ? (catalogues[0] ?? null) : get().catalogue
    set({ catalogues, catalogue })
    if (catalogue) await settingsRepo.setValue('activeCatalogue', catalogue.gameId)
  },

  async saveUnit(unit) {
    await unitsRepo.save(unit)
    set({ units: await unitsRepo.list() })
    await syncShopping(unit)
  },

  async deleteUnit(id) {
    await unitsRepo.delete(id)
    const open = useStore.getState().shopItems.find((x) => !x.bought && x.unitId === id)
    if (open) await useStore.getState().deleteShopItem(open.id)
    const events = { ...get().events }
    delete events[id]
    const photos = { ...get().photos }
    delete photos[id]
    set({ units: await unitsRepo.list(), events, photos, lists: await listRepo.list() })
  },

  allEvents() {
    return eventsRepo.listAll()
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
    await syncShopping(updated)
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
  homeLayout: DEFAULT_LAYOUT,
  games: [],
  async saveGame(g) {
    const list = get().games.some((x) => x.id === g.id) ? get().games.map((x) => (x.id === g.id ? g : x)) : [g, ...get().games]
    set({ games: list })
    await settingsRepo.setValue('games', list)
  },
  async deleteGame(id) {
    const list = get().games.filter((x) => x.id !== id)
    set({ games: list })
    await settingsRepo.setValue('games', list)
  },
  stratagemData: null,
  async importStratagems(files) {
    const data = parseWahapedia(await Promise.all(files.map((f) => f.text())), ctx().now)
    // A file of one kind keeps the other kind from the earlier import.
    const old = get().stratagemData
    const merged = { ...data, stratagems: data.stratagems.length ? data.stratagems : old?.stratagems ?? [], detachmentRules: data.detachmentRules.length ? data.detachmentRules : old?.detachmentRules ?? [] }
    await settingsRepo.setValue('stratagems', merged)
    set({ stratagemData: merged })
  },
  async removeStratagems() {
    await settingsRepo.setValue('stratagems', null)
    set({ stratagemData: null })
  },
  goals: [],
  async saveGoal(g) {
    const list = get().goals.some((x) => x.id === g.id) ? get().goals.map((x) => (x.id === g.id ? g : x)) : [...get().goals, g]
    set({ goals: list })
    await settingsRepo.setValue('goals', list)
  },
  async deleteGoal(id) {
    const list = get().goals.filter((x) => x.id !== id)
    set({ goals: list })
    await settingsRepo.setValue('goals', list)
  },
  paintSessions: [],
  paintTimers: [],
  storage: EMPTY_STORAGE,
  async saveStorage(x) {
    set({ storage: x })
    await settingsRepo.setValue('storage', x)
  },
  companion: null,
  openCompanion(mode, unitId, timerId) {
    set({ companion: { mode, unitId, timerId } })
  },
  closeCompanion() {
    set({ companion: null })
  },
  companionTicks: {},
  async toggleTick(unitId, key) {
    const t = flipTick(get().companionTicks, unitId, key)
    set({ companionTicks: t })
    await settingsRepo.setValue('companionTicks', t)
  },
  async clearTicks(unitId, prefix) {
    const t = clearTicks(get().companionTicks, unitId, prefix)
    set({ companionTicks: t })
    await settingsRepo.setValue('companionTicks', t)
  },
  async saveSession(x) {
    const list = get().paintSessions.some((y) => y.id === x.id) ? get().paintSessions.map((y) => (y.id === x.id ? x : y)) : [...get().paintSessions, x]
    set({ paintSessions: list })
    await settingsRepo.setValue('paintSessions', list)
  },
  async deleteSession(id) {
    const list = get().paintSessions.filter((y) => y.id !== id)
    set({ paintSessions: list })
    await settingsRepo.setValue('paintSessions', list)
  },
  async saveTimer(t) {
    const list = get().paintTimers.some((y) => y.id === t.id) ? get().paintTimers.map((y) => (y.id === t.id ? t : y)) : [...get().paintTimers, t]
    set({ paintTimers: list })
    await settingsRepo.setValue('paintTimers', list)
  },
  async deleteTimer(id) {
    const list = get().paintTimers.filter((y) => y.id !== id)
    set({ paintTimers: list })
    await settingsRepo.setValue('paintTimers', list)
  },
  async stopTimer(id) {
    const t = get().paintTimers.find((y) => y.id === id)
    if (!t) return
    const list = [...get().paintSessions, ...endTimer(t, ctx())]
    set({ paintSessions: list })
    await settingsRepo.setValue('paintSessions', list)
    await get().deleteTimer(id)
  },
  purchases: [],
  async savePurchase(p) {
    const list = get().purchases.some((x) => x.id === p.id) ? get().purchases.map((x) => (x.id === p.id ? p : x)) : [...get().purchases, p]
    set({ purchases: list })
    await settingsRepo.setValue('purchases', list)
  },
  async deletePurchase(id) {
    const list = get().purchases.filter((x) => x.id !== id)
    set({ purchases: list })
    await settingsRepo.setValue('purchases', list)
  },
  currency: '€',
  async setCurrency(c) {
    set({ currency: c })
    await settingsRepo.setValue('currency', c)
  },
  supplies: [],
  async saveSupply(supply) {
    const before = get().supplies.find((x) => x.id === supply.id)
    const list = before ? get().supplies.map((x) => (x.id === supply.id ? supply : x)) : [...get().supplies, supply]
    set({ supplies: list })
    await settingsRepo.setValue('supplies', list)
    // Reaching the alert level puts it on the shopping list.
    if (becameLow(before, supply)) await get().addToShopping([supplyItem(supply)], [])
  },
  async deleteSupply(id) {
    const list = get().supplies.filter((x) => x.id !== id)
    set({ supplies: list })
    await settingsRepo.setValue('supplies', list)
  },
  async saveHomeLayout(l) {
    set({ homeLayout: l })
    await settingsRepo.setValue('homeLayout', l)
  },

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

  // Update memory first, then save: overlapping calls (field blur + create) then build on each other.
  async rememberLink(link) {
    const others = get().recipeLinks.filter((l) => l.url !== link.url)
    const prev = get().recipeLinks.find((l) => l.url === link.url)
    const merged = { ...prev, ...link, addedAt: prev?.addedAt ?? new Date().toISOString() }
    if (prev?.schemeId && !link.schemeId) merged.schemeId = prev.schemeId
    set({ recipeLinks: [merged, ...others] })
    await settingsRepo.setValue('recipeLinks', get().recipeLinks)
  },

  async forgetLink(url) {
    set({ recipeLinks: get().recipeLinks.filter((l) => l.url !== url) })
    await settingsRepo.setValue('recipeLinks', get().recipeLinks)
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

  lists: [],

  // Memory first so quick edits (typing, clicking +) build on each other, then save.
  async saveList(l) {
    set({ lists: [l, ...get().lists.filter((x) => x.id !== l.id)] })
    await listRepo.save(l)
  },

  async deleteList(id) {
    set({ lists: get().lists.filter((x) => x.id !== id) })
    await listRepo.delete(id)
  },

  shopItems: [],
  shopLists: [],

  async addToShopping(incoming, listIds, newListName) {
    const ids = [...listIds]
    if (newListName?.trim()) ids.push((await get().createShopList(newListName)).id)
    const { items, changed } = addItems(get().shopItems, incoming, ids, ctx())
    set({ shopItems: items })
    await shopRepo.saveItems(changed)
  },

  async saveShopItem(item) {
    set({ shopItems: get().shopItems.map((x) => (x.id === item.id ? item : x)) })
    await shopRepo.saveItems([item])
  },

  async deleteShopItem(id) {
    set({ shopItems: get().shopItems.filter((x) => x.id !== id) })
    await shopRepo.deleteItem(id)
  },

  async setBought(id, bought, paint) {
    const item = get().shopItems.find((x) => x.id === id)
    if (!item) return
    const c = ctx()
    await get().saveShopItem({ ...item, bought, updatedAt: c.now })
    const unit = bought && item.kind === 'model' && item.unitId ? get().units.find((u) => u.id === item.unitId) : undefined
    if (unit) {
      // Bought models leave the wishlist: move up to the item's quantity to the first owned stage.
      let left = item.qty
      for (const g of unit.groups.filter((x) => x.status === WISHLISTED)) {
        if (left <= 0) break
        const n = Math.min(left, g.count)
        left -= n
        const fresh = get().units.find((u) => u.id === unit.id)!
        await get().move(fresh, g.id, n, firstOwnedStage(get().pipeline), { note: 'Bought' })
      }
    }
    if (!bought || item.kind !== 'paint' || !item.refId || !paint) return
    const old = get().paintStock.get(item.refId)
    const base = old ?? newStock(item.refId, 'wishlist', c)
    await get().saveStock(
      paint === 'owned'
        ? { ...base, stage: 'sealed', quantity: base.quantity + item.qty, purchaseDate: c.now.slice(0, 10), updatedAt: c.now }
        : { ...base, stage: 'ordered', updatedAt: c.now },
    )
  },

  async addFromCatalogue(item, listIds, backlog = 'none') {
    const c = ctx()
    let unitId: string | undefined
    if (item.kind === 'model' && backlog === 'new') {
      const d = get().catalogue?.datasheets.find((x) => x.id === item.refId)
      const u = createUnit({ customName: item.name, datasheetId: item.refId, factionId: d?.factionIds[0], groups: [{ count: item.qty, status: WISHLISTED }] }, c)
      await get().saveUnit(u)
      unitId = u.id
    } else if (item.kind === 'model' && typeof backlog === 'object') {
      const u = get().units.find((x) => x.id === backlog.unitId)
      if (u) {
        await get().saveUnit(mergeGroups({ ...u, groups: [...u.groups, { id: c.newId(), count: item.qty, status: WISHLISTED, loadout: [], magnetised: [] }] }, c))
        unitId = u.id
      }
    }
    if (item.kind === 'paint' && item.refId && !get().paintStock.has(item.refId)) await get().saveStock(newStock(item.refId, 'wishlist', c))
    await get().addToShopping([{ ...item, unitId }], listIds)
  },

  async createShopList(name) {
    const l = newList(name, ctx())
    set({ shopLists: [...get().shopLists, l] })
    await shopRepo.saveList(l)
    return l
  },

  async renameShopList(id, name) {
    const l = get().shopLists.find((x) => x.id === id)
    if (!l || !name.trim()) return
    const n = { ...l, name: name.trim() }
    set({ shopLists: get().shopLists.map((x) => (x.id === id ? n : x)) })
    await shopRepo.saveList(n)
  },

  async deleteShopList(id) {
    const changed = withoutList(get().shopItems, id, ctx())
    const byId = new Map(changed.map((x) => [x.id, x]))
    set({ shopLists: get().shopLists.filter((x) => x.id !== id), shopItems: get().shopItems.map((x) => byId.get(x.id) ?? x) })
    await Promise.all([shopRepo.deleteList(id), shopRepo.saveItems(changed)])
  },

  async dropOriginals() {
    const freed = await photoRepo.dropOriginals()
    set({ photos: {} })
    return freed
  },
}))

/** Wishlisted backlog models follow onto the shopping list (see syncWishlisted). */
async function syncShopping(unit: OwnedUnit) {
  const item = syncWishlisted(useStore.getState().shopItems, unit, ctx())
  if (!item) return
  const items = useStore.getState().shopItems
  useStore.setState({ shopItems: items.some((x) => x.id === item.id) ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item] })
  await shopRepo.saveItems([item])
}
