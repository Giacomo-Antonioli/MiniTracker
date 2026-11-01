import type { BattleSize, Catalogue, Datasheet, Enhancement } from '../catalogue/types'
import { evalCondition, evalLimit, type Counter } from './conditions'
import type { Ctx } from '../collection/types'
import { addEntry } from './list'
import { listPoints } from './points'
import type { ArmyList } from './types'

/**
 * List checks for an edition, driven by the catalogue (BSData), plus a few rules the data does not hold:
 * Combat Patrol (500 points, points check only), exactly one Warlord, Epic Heroes at most once, enhancements only on
 * Characters that are not Epic Heroes, one per unit, and at most 3 when the data gives no number (10th edition).
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
  | 'no-detachment'
  | 'detachments'
  | 'detachment-points'
  | 'detachment-faction'
  | 'unknown-detachment'
  | 'enhancements'
  | 'enhancement-detachment'
  | 'enhancement-twice'
  | 'enhancement-unit'
  | 'unknown-enhancement'
  | 'not-a-leader'
  | 'leader-target'
  | 'leaders'

export interface ListIssue {
  code: IssueCode
  message: string
  /** Entries the problem is about (empty for whole-list problems). */
  entryIds: string[]
}

// BSData also uses a keyword named after the unit itself (e.g. "Strike Team"), which datasheets don't list.
const hasKeyword = (d: Datasheet, k: string) => d.role === k || d.keywords.includes(k) || d.name === k

/** Can this Leader be attached to that unit? */
export function canLead(leader: Datasheet, target: Datasheet): boolean {
  return !!leader.leads && (leader.leads.ids.includes(target.id) || leader.leads.keywords.some((k) => hasKeyword(target, k)))
}

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

  const enh = new Map((cat.enhancements ?? []).map((x) => [x.id, x]))
  const pts = listPoints(l, sheets, enh)
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
    // Epic Heroes are Characters in the rules, even when the data leaves the keyword out (e.g. The Silent King).
    if (d && !hasKeyword(d, 'Character') && !hasKeyword(d, 'Epic Hero')) add('warlord-not-character', `${d.name} is not a Character and can't be the Warlord`, [e.id])
  }
  checkLeaders(l, cat, sheets, add)
  if (cat.detachments) checkDetachments(l, cat, sheets, enh, add)
  return issues
}

/** Counts what a list has, for BSData conditions (see conditions.ts). */
export function listCounter(l: ArmyList, cat: Catalogue): Counter {
  const sheets = new Map(cat.datasheets.map((d) => [d.id, d]))
  const dets = (cat.detachments ?? []).filter((d) => l.detachmentIds?.includes(d.id))
  return ({ id, keyword }) => {
    if (keyword) {
      return dets.filter((d) => d.keywords.includes(keyword)).length + l.entries.filter((e) => {
        const d = sheets.get(e.datasheetId)
        return d && hasKeyword(d, keyword)
      }).length
    }
    if (!id) return 0
    if (id === l.battleSize || id === cat.muster?.forceId) return 1
    return dets.filter((d) => d.id === id).length + l.entries.filter((e) => e.datasheetId === id || e.enhancementId === id).length
  }
}

function checkLeaders(l: ArmyList, cat: Catalogue, sheets: Map<string, Datasheet>, add: (code: IssueCode, message: string, entryIds?: string[]) => void) {
  // Leader data comes with catalogue format 6; older catalogues have none, so nothing can be checked.
  if (!cat.datasheets.some((d) => d.leads)) return
  const byId = new Map(l.entries.map((e) => [e.id, e]))
  const leadersOf = new Map<string, string[]>()
  for (const e of l.entries) {
    if (!e.attachedTo) continue
    const leader = sheets.get(e.datasheetId)
    const targetEntry = byId.get(e.attachedTo)
    const target = targetEntry && sheets.get(targetEntry.datasheetId)
    if (!leader || !target) continue
    leadersOf.set(e.attachedTo, [...(leadersOf.get(e.attachedTo) ?? []), e.id])
    if (!leader.leads) add('not-a-leader', `${leader.name} is not a Leader`, [e.id])
    else if (!canLead(leader, target)) add('leader-target', `${leader.name} can't lead ${target.name}`, [e.id, e.attachedTo])
  }
  for (const [targetId, leaders] of leadersOf) {
    const target = sheets.get(byId.get(targetId)!.datasheetId)!
    const max = target.maxLeaders ?? 1
    if (leaders.length > max) add('leaders', `${target.name} has ${leaders.length} Leaders, max ${max}`, [targetId, ...leaders])
  }
}

/**
 * Can this list entry take this enhancement, by the data's "hidden when" conditions seen from that unit?
 * Characters-only / not-Epic-Hero and "is its detachment chosen" are checked separately.
 */
export function enhancementAllowed(l: ArmyList, cat: Catalogue, e: ArmyList['entries'][number], x: Enhancement): boolean {
  if (!x.notFor) return true
  const d = cat.datasheets.find((s) => s.id === e.datasheetId)
  if (!d) return true
  const army = listCounter(l, cat)
  const bearer = { ...e, enhancementId: x.id }
  const unit: Counter = (leaf) => (leaf.keyword ? Number(hasKeyword(d, leaf.keyword)) : Number(leaf.id === d.id || leaf.id === bearer.enhancementId))
  // Asking "could it take this" for a unit that doesn't have it yet: count it as taken by this unit, not elsewhere.
  const withIt = { ...l, entries: l.entries.map((y) => (y.id === e.id ? bearer : y)) }
  const armyWith = listCounter(withIt, cat)
  return !evalCondition(x.notFor, (leaf) => (leaf.unit ? unit(leaf) : e.enhancementId === x.id ? army(leaf) : armyWith(leaf)))
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function checkDetachments(
  l: ArmyList,
  cat: Catalogue,
  sheets: Map<string, Datasheet>,
  enh: Map<string, Enhancement>,
  add: (code: IssueCode, message: string, entryIds?: string[]) => void,
) {
  const count = listCounter(l, cat)
  const all = new Map((cat.detachments ?? []).map((d) => [d.id, d]))
  const chosen = l.detachmentIds ?? []
  for (const id of chosen) {
    const d = all.get(id)
    if (!d) add('unknown-detachment', 'A detachment is not in the catalogue (removed or renamed?)')
    else if (l.factionId && !d.factionIds.includes(l.factionId)) add('detachment-faction', `${d.name} is not a detachment of this faction`)
  }
  const rule = l.factionId ? cat.detachmentCounts?.[l.factionId] : undefined
  if (chosen.length < (rule?.min ?? 1)) add('no-detachment', 'Choose a detachment')
  const maxDets = rule ? evalLimit(rule.max, count) : -1
  if (maxDets >= 0 && chosen.length > maxDets) add('detachments', `${plural(chosen.length, 'detachment')}, max ${maxDets} here`)
  if (cat.muster?.detachmentPoints) {
    const budget = evalLimit(cat.muster.detachmentPoints, count)
    const used = chosen.reduce((n, id) => n + (all.get(id)?.detachmentPoints ?? 0), 0)
    if (budget >= 0 && used > budget) add('detachment-points', `Detachments cost ${used} detachment points, max ${budget}`)
  }

  const withEnh = l.entries.filter((e) => e.enhancementId)
  const cap = cat.muster?.enhancements ? evalLimit(cat.muster.enhancements, count) : 3
  if (cap >= 0 && withEnh.length > cap) add('enhancements', `${plural(withEnh.length, 'enhancement')}, max ${cap}`, withEnh.map((e) => e.id))
  const seen = new Map<string, string[]>()
  for (const e of withEnh) {
    const x = enh.get(e.enhancementId!)
    const d = sheets.get(e.datasheetId)
    if (!x) {
      add('unknown-enhancement', 'An enhancement is not in the catalogue (removed or renamed?)', [e.id])
      continue
    }
    seen.set(x.id, [...(seen.get(x.id) ?? []), e.id])
    if (!chosen.includes(x.detachmentId)) add('enhancement-detachment', `${x.name} needs its detachment (${all.get(x.detachmentId)?.name ?? 'not chosen'})`, [e.id])
    if (d && (!hasKeyword(d, 'Character') || hasKeyword(d, 'Epic Hero'))) add('enhancement-unit', `${d.name} can't take an enhancement (Characters only, not Epic Heroes)`, [e.id])
    else if (d && chosen.includes(x.detachmentId) && !enhancementAllowed(l, cat, e, x)) add('enhancement-unit', `${d.name} can't take ${x.name}`, [e.id])
  }
  for (const [id, entryIds] of seen) if (entryIds.length > 1) add('enhancement-twice', `${enh.get(id)!.name} is taken ${entryIds.length} times`, entryIds)
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
