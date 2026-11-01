import { create } from 'zustand'
import { exportBackup, importBackup, parseBackup } from '../data/backup'
import { MiniTrackerDb } from '../data/db'
import { DexieEventRepository, DexieSettingsRepository, DexieUnitRepository } from '../data/repositories/dexie'
import { DEFAULT_PIPELINE, moveModels, type MoveOptions } from '../domain/collection/pipeline'
import type { Ctx, OwnedUnit, Pipeline, StageId, StatusEvent } from '../domain/collection/types'

const db = new MiniTrackerDb()
const unitsRepo = new DexieUnitRepository(db)
const eventsRepo = new DexieEventRepository(db)
const settingsRepo = new DexieSettingsRepository(db)

export const ctx = (): Ctx => ({ now: new Date().toISOString(), newId: () => crypto.randomUUID() })

interface State {
  ready: boolean
  units: OwnedUnit[]
  pipeline: Pipeline
  /** History per unit id, loaded on demand. */
  events: Record<string, StatusEvent[]>
  load(): Promise<void>
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

  async load() {
    const [units, pipeline] = await Promise.all([unitsRepo.list(), settingsRepo.getPipeline()])
    set({ units, pipeline, ready: true })
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
