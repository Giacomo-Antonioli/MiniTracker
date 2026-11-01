import { totalModels } from '../collection/ownedUnit'
import { isGone } from '../collection/pipeline'
import type { OwnedUnit } from '../collection/types'
import type { Datasheet } from './types'

/** How many units and models you own per datasheet (units still in the collection only). */
export function ownedByDatasheet(units: OwnedUnit[]): Map<string, { units: number; models: number }> {
  const out = new Map<string, { units: number; models: number }>()
  for (const u of units) {
    if (!u.datasheetId || isGone(u.lifecycle)) continue
    const cur = out.get(u.datasheetId) ?? { units: 0, models: 0 }
    out.set(u.datasheetId, { units: cur.units + 1, models: cur.models + totalModels(u) })
  }
  return out
}

/** Price steps as rows like { models: '6–10', points: 160 }. */
export function pointsTable(d: Datasheet): { models: string; points: number }[] {
  return d.points.map((s, i) => {
    const to = (d.points[i + 1]?.fromModels ?? d.maxModels + 1) - 1
    return { models: to > s.fromModels ? `${s.fromModels}–${to}` : `${s.fromModels}`, points: s.points }
  })
}
