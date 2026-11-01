import type { Catalogue } from '../../domain/catalogue/types'
import type { OwnedUnit } from '../../domain/collection/types'
import { listOwnership } from '../../domain/lists/ownership'
import { listPoints } from '../../domain/lists/points'
import { battleSizes, checkList, type ListIssue } from '../../domain/lists/rules'
import type { ArmyList } from '../../domain/lists/types'

export interface ListSummary {
  points: number
  complete: boolean
  missingModels: number
  /** Undefined when the catalogue can't check rules (not installed, or downloaded before checks existed). */
  issues?: ListIssue[]
  factionName?: string
  battleSizeName?: string
}

export function summarise(l: ArmyList, cat: Catalogue | undefined, units: OwnedUnit[]): ListSummary {
  const own = listOwnership(l, units)
  const sheets = new Map((cat?.datasheets ?? []).map((d) => [d.id, d]))
  return {
    points: listPoints(l, sheets, new Map((cat?.enhancements ?? []).map((x) => [x.id, x]))).total,
    complete: own.complete,
    missingModels: own.missingModels,
    issues: cat?.muster ? checkList(l, cat) : undefined,
    factionName: cat?.factions.find((f) => f.id === l.factionId)?.name,
    battleSizeName: cat ? battleSizes(cat).find((b) => b.id === l.battleSize)?.name : undefined,
  }
}
