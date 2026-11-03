import type { ModelGroup, OwnedUnit, Pipeline, Stage } from './types'

export interface BoardCard { unit: OwnedUnit; group: ModelGroup }

/** Kanban columns: one per stage, one card per model group (a unit split across stages shows up in each). */
export function boardColumns(units: OwnedUnit[], pipeline: Pipeline): { stage: Stage; cards: BoardCard[] }[] {
  return pipeline.stages.map((stage) => ({
    stage,
    cards: units
      .flatMap((unit) => unit.groups.filter((g) => g.status === stage.id && g.count > 0).map((group) => ({ unit, group })))
      .sort((a, b) => a.unit.customName.localeCompare(b.unit.customName)),
  }))
}
