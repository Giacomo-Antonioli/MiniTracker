import type { BattleSize, Catalogue, Datasheet } from '../catalogue/types'
import type { Ctx } from '../collection/types'
import { addEntry } from './list'
import { listPoints } from './points'
import type { ArmyList } from './types'

/**
 * List checks for an edition, driven by the catalogue (BSData), plus a few rules the data does not hold:
 * Combat Patrol (500 points, points check only), exactly one Warlord, and Epic Heroes at most once.
 * Problems are reported, never enforced: a list that breaks rules can still be saved.
 */

/** BSData has no Combat Patrol; it is a fixed-box format, so only points are checked. */
export const COMBAT_PATROL: BattleSize = { id: 'combat-patrol', name: 'Combat Patrol', pointsLimit: 500 }

export function battleSizes(cat: Catalogue): BattleSize[] {
  return [COMBAT_PATROL, ...(cat.muster?.battleSizes ?? [])]
}

export type IssueCode =
  | 'battle-size'
  | 'unknown-unit'
  | 'unit-size'
  | 'points'
  | 'unit-limit'
  | 'keyword-minimum'
  | 'no-warlord'
  | 'warlords'
  | 'warlord-not-character'

export interface ListIssue {
  code: IssueCode
  message: string
  /** Entries the problem is about (empty for whole-list problems). */
  entryIds: string[]
}

const hasKeyword = (d: Datasheet, k: string) => d.role === k || d.keywords.includes(k)

/** Most units of this datasheet allowed at this battle size; undefined = not checked. */
export function unitLimit(d: Datasheet, battleSize: string): number | undefined {
  if (d.armyLimit) return d.armyLimit.byBattleSize?.[battleSize] ?? d.armyLimit.max
  return hasKeyword(d, 'Epic Hero') ? 1 : undefined
}

export function checkList(l: ArmyList, cat: Catalogue): ListIssue[] {
  const issues: ListIssue[] = []
  const add = (code: IssueCode, message: string, entryIds: string[] = []) => issues.push({ code, message, entryIds })
  const sheets = new Map(cat.datasheets.map((d) => [d.id, d]))
  const size = battleSizes(cat).find((b) => b.id === l.battleSize)
  if (!size) add('battle-size', 'Battle size not found in this edition')

  const pts = listPoints(l, sheets)
  for (const e of l.entries) {
    const d = sheets.get(e.datasheetId)
    if (!d) add('unknown-unit', 'Unit not in the catalogue (removed or renamed?)', [e.id])
    else if (pts.byEntry.get(e.id) === undefined) add('unit-size', `${d.name} must have ${d.minModels}–${d.maxModels} models`, [e.id])
  }
  if (pts.total > l.pointsLimit) add('points', `${pts.total} points, limit ${l.pointsLimit}`)
  if (l.battleSize === COMBAT_PATROL.id || l.entries.length === 0) return issues

  const byDatasheet = new Map<string, string[]>()
  for (const e of l.entries) byDatasheet.set(e.datasheetId, [...(byDatasheet.get(e.datasheetId) ?? []), e.id])
  for (const [id, entryIds] of byDatasheet) {
    const d = sheets.get(id)
    const max = d && unitLimit(d, l.battleSize)
    if (d && max !== undefined && entryIds.length > max) add('unit-limit', `${d.name}: ${entryIds.length}, max ${max}`, entryIds)
  }

  for (const m of cat.muster?.keywordMinimums ?? []) {
    if (l.factionId && m.exemptFactionIds.includes(l.factionId)) continue
    const n = l.entries.filter((e) => {
      const d = sheets.get(e.datasheetId)
      return d && hasKeyword(d, m.keyword)
    }).length
    if (n < m.min) add('keyword-minimum', `Needs at least ${m.min} ${m.keyword}${m.min > 1 ? ' units' : ''}`)
  }

  const warlords = l.entries.filter((e) => e.warlord)
  if (warlords.length === 0) add('no-warlord', 'Choose a Warlord')
  if (warlords.length > 1) add('warlords', 'Only one Warlord', warlords.map((e) => e.id))
  for (const e of warlords) {
    const d = sheets.get(e.datasheetId)
    if (d && !hasKeyword(d, 'Character')) add('warlord-not-character', `${d.name} is not a Character and can't be the Warlord`, [e.id])
  }
  return issues
}

/** Units a list of this faction can take. */
export function legalUnits(cat: Catalogue, factionId: string, opts: { legends?: boolean } = {}): Datasheet[] {
  return cat.datasheets.filter((d) => d.factionIds.includes(factionId) && (opts.legends || !d.legends))
}

/**
 * Adds a unit; when the list has no faction yet it takes the unit's faction.
 * A unit found in several factions (e.g. a Space Marines unit also in Ultramarines) needs `factionId` to choose.
 */
export function addUnit(l: ArmyList, d: Datasheet, models: number, ctx: Ctx, factionId?: string): ArmyList {
  let faction = l.factionId
  if (!faction) {
    faction = factionId ?? (d.factionIds.length === 1 ? d.factionIds[0] : undefined)
    if (!faction) throw new Error(`${d.name} is in several factions: choose one`)
  }
  if (!d.factionIds.includes(faction)) throw new Error(`${d.name} is not a unit of this faction`)
  return addEntry({ ...l, factionId: faction }, { datasheetId: d.id, models }, ctx)
}
