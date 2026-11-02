import type { PipelineKey } from '../../domain/pipelines'
import type { OwnedUnit, Pipeline, StatusEvent } from '../../domain/collection/types'

/** The only way the app reads or writes units. Swappable (IndexedDB now, sync later). */
export interface UnitRepository {
  get(id: string): Promise<OwnedUnit | undefined>
  list(): Promise<OwnedUnit[]>
  save(unit: OwnedUnit): Promise<void>
  /** Deletes the unit and its whole history. */
  delete(id: string): Promise<void>
  /** Saves the updated unit and its history event atomically. */
  recordMove(unit: OwnedUnit, event: StatusEvent): Promise<void>
}

export interface EventRepository {
  /** Oldest first. */
  listForUnit(unitId: string): Promise<StatusEvent[]>
  /** Every move of every unit, for stats. */
  listAll(): Promise<StatusEvent[]>
}

export interface SettingsRepository {
  getPipeline(key?: PipelineKey): Promise<Pipeline>
  savePipeline(pipeline: Pipeline, key?: PipelineKey): Promise<void>
}
