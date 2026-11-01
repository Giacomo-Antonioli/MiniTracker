import type { Catalogue, Datasheet } from '../catalogue/types'
import type { Ctx } from '../collection/types'
import { addEntry, createList, validateList } from './list'
import { listPoints } from './points'
import { COMBAT_PATROL, battleSizes } from './rules'
import type { ArmyList, EditionKey } from './types'

/**
 * Import and export of army lists:
 * - BattleScribe / NewRecruit rosters (.rosz/.ros), read into a neutral `Roster` by the data layer and matched by BSData ids;
 * - plain text (GW app / NewRecruit style), matched by names, best effort;
 * - MiniTracker JSON (lossless).
 */

export interface RosterSelection {
  /** Every id the selection carries (BattleScribe entryId "link::target" split, plus entryGroupId). */
  ids: string[]
  name: string
  type?: string
  number: number
  children: RosterSelection[]
}

export interface Roster {
  name: string
  forces: { catalogueId?: string; catalogueName?: string; selections: RosterSelection[] }[]
}

export interface ImportResult {
  list: ArmyList
  /** What could not be matched or was guessed. */
  warnings: string[]
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\[legends\]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .trim()

/** Battle size by a name found in the text (e.g. "Strike Force (2000 Point limit)"), else the smallest one that fits the points. */
function pickBattleSize(cat: Catalogue, texts: string[], points: number): { id: string; limit: number; guessed: boolean } {
  const sizes = battleSizes(cat)
  const named = sizes.find((b) => texts.some((t) => norm(t).includes(norm(b.name))))
  if (named) return { id: named.id, limit: named.pointsLimit, guessed: false }
  // Combat Patrol is a fixed-box format: only when named.
  const open = sizes.filter((b) => b.id !== COMBAT_PATROL.id)
  const fit = open.find((b) => b.pointsLimit >= points) ?? open[open.length - 1] ?? sizes[0]
  return { id: fit.id, limit: fit.pointsLimit, guessed: true }
}

function finish(l: ArmyList, cat: Catalogue, texts: string[], warnings: string[]): ImportResult {
  const sheets = new Map(cat.datasheets.map((d) => [d.id, d]))
  const enh = new Map((cat.enhancements ?? []).map((x) => [x.id, x]))
  const size = pickBattleSize(cat, texts, listPoints(l, sheets, enh).total)
  if (size.guessed) warnings.push('Battle size not found: chosen from the points')
  const out = { ...l, battleSize: size.id, pointsLimit: size.limit }
  validateList(out)
  return { list: out, warnings }
}

/** A roster (from .rosz/.ros) as a list, matched by BSData ids. */
export function listFromRoster(r: Roster, cat: Catalogue, edition: EditionKey, ctx: Ctx): ImportResult {
  const sheets = new Map(cat.datasheets.map((d) => [d.id, d]))
  const dets = new Map((cat.detachments ?? []).map((d) => [d.id, d]))
  const enh = new Map((cat.enhancements ?? []).map((x) => [x.id, x]))
  const factions = new Map(cat.factions.map((f) => [f.id, f]))
  const warnings: string[] = []
  const texts: string[] = [r.name]

  const force = r.forces[0]
  if (!force) throw new Error('This roster has no army in it')
  if (r.forces.length > 1) warnings.push(`Only the first of ${r.forces.length} forces was imported`)
  const factionId =
    (force.catalogueId && factions.has(force.catalogueId) ? force.catalogueId : undefined) ??
    cat.factions.find((f) => force.catalogueName && norm(f.fullName) === norm(force.catalogueName))?.id
  if (!factionId) warnings.push(`Faction not found: ${force.catalogueName ?? 'unknown'}`)

  let l = createList({ name: r.name.trim() || 'Imported list', edition, battleSize: '', pointsLimit: 0, ...(factionId ? { factionId } : {}) }, ctx)
  const detachmentIds: string[] = []
  const find = <T>(s: RosterSelection, m: Map<string, T>) => s.ids.map((id) => m.get(id)).find((x) => x !== undefined)
  const descendants = (s: RosterSelection): RosterSelection[] => s.children.flatMap((c) => [c, ...descendants(c)])

  const visit = (s: RosterSelection) => {
    texts.push(s.name)
    const det = find(s, dets)
    if (det) {
      if (!detachmentIds.includes(det.id)) detachmentIds.push(det.id)
      return
    }
    // A choice inside the roster's detachment selection that the catalogue doesn't know (renamed or removed).
    if (/detachment/i.test(s.name) && s.children.length && !s.children.some((c) => find(c, dets))) {
      for (const c of s.children) if (c.type === 'upgrade') warnings.push(`Detachment not in the catalogue: ${c.name}`)
      return
    }
    const d = find(s, sheets)
    if (d) {
      const inner = descendants(s)
      const modelCount = inner.filter((x) => x.type === 'model').reduce((n, x) => n + x.number, 0)
      const models = modelCount || (s.type === 'model' ? s.number : d.minModels)
      const e = inner.map((x) => find(x, enh)).find((x) => x !== undefined)
      const warlord = inner.some((x) => norm(x.name) === 'warlord')
      l = addEntry(l, { datasheetId: d.id, models, ...(e ? { enhancementId: e.id } : {}), ...(warlord ? { warlord: true } : {}) }, ctx)
      return
    }
    if (s.type === 'unit' || (s.type === 'model' && !s.children.some((c) => c.type === 'model'))) {
      warnings.push(`Not in the catalogue: ${s.name}`)
      return
    }
    s.children.forEach(visit)
  }
  force.selections.forEach(visit)
  return finish({ ...l, detachmentIds }, cat, texts, warnings)
}

const UNIT_LINE = /^(?:(\d+)\s*x\s+)?(.+?)\s*[([]\s*\+?(\d[\d,.]*)\s*(?:pts|points?)\s*[)\]]\s*$/i
const BULLET = /^(\s*)(?:[•●▪◦*-]|\d+\.)\s*(.*)$/
const COUNT = /^(\d+)\s*x?\s+(.*)$/i

/** A plain-text list (GW app, NewRecruit, or MiniTracker's own export), matched by names. Best effort. */
export function listFromText(text: string, cat: Catalogue, edition: EditionKey, ctx: Ctx): ImportResult {
  const warnings: string[] = []
  const lines = text.split(/\r?\n/)
  const nonEmpty = lines.map((x) => x.trim()).filter(Boolean)
  const byName = (name: string, pool: Datasheet[]) => pool.find((d) => norm(d.name) === norm(name))
  const factionId =
    cat.factions.find((f) => nonEmpty.some((x) => norm(x) === norm(f.name) || norm(x) === norm(f.fullName)))?.id ??
    undefined

  // Units: "Name (N points)" lines, with the bullet lines under them.
  type Block = { name: string; copies: number; bullets: { indent: number; text: string }[] }
  const blocks: Block[] = []
  let cur: Block | undefined
  for (const raw of lines) {
    if (!raw.trim()) continue
    const b = BULLET.exec(raw)
    if (b && cur) {
      cur.bullets.push({ indent: b[1].replace(/\t/g, '  ').length, text: b[2].trim() })
      continue
    }
    const u = UNIT_LINE.exec(raw.trim())
    if (u) {
      cur = { name: u[2].trim(), copies: Number(u[1] ?? 1), bullets: [] }
      blocks.push(cur)
    } else cur = undefined
  }

  const inFaction = (d: Datasheet, f?: string) => !f || d.factionIds.includes(f)
  let faction = factionId
  const resolved = blocks.map((b) => ({ b, d: byName(b.name, cat.datasheets.filter((d) => inFaction(d, faction))) ?? byName(b.name, cat.datasheets) }))
  if (!faction) {
    // Most common faction of the matched units.
    const votes = new Map<string, number>()
    for (const { d } of resolved) for (const f of d?.factionIds ?? []) votes.set(f, (votes.get(f) ?? 0) + 1)
    faction = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0]
  }

  let l = createList({ name: nonEmpty[0]?.replace(UNIT_LINE, '$2').replace(/\s*\(.*$/, '').trim() || 'Imported list', edition, battleSize: '', pointsLimit: 0, ...(faction ? { factionId: faction } : {}) }, ctx)
  const detachments = (cat.detachments ?? []).filter((d) => !faction || d.factionIds.includes(faction))
  // A line that is a detachment name, or "Detachment(s): A, B".
  const detachmentNames = new Set(nonEmpty.flatMap((x) => x.replace(/^detachments?\s*:/i, '').split(',').map(norm)))
  const detachmentIds = detachments.filter((d) => detachmentNames.has(norm(d.name))).map((d) => d.id)
  const enhancements = (cat.enhancements ?? []).filter((x) => detachmentIds.length === 0 || detachmentIds.includes(x.detachmentId))

  const title = UNIT_LINE.exec(nonEmpty[0] ?? '')?.[2].trim()
  const notUnits = new Set([...(title ? [norm(title)] : []), ...battleSizes(cat).map((x) => norm(x.name)), ...detachments.map((x) => norm(x.name))])
  for (const { b, d } of resolved) {
    if (!d) {
      // The list's title line and "Strike Force (2,000 points)" look like units too.
      const n = norm(b.name)
      if (!notUnits.has(n) && !battleSizes(cat).some((x) => n.includes(norm(x.name)))) warnings.push(`Not in the catalogue: ${b.name}`)
      continue
    }
    const top = Math.min(...b.bullets.map((x) => x.indent), Infinity)
    let counted = 0
    let warlord = false
    let enhancementId: string | undefined
    for (const x of b.bullets) {
      const t = x.text.replace(/^enhancements?\s*:\s*/i, '').replace(/\s*\(\+?\d+.*\)\s*$/, '')
      if (norm(x.text) === 'warlord') warlord = true
      const e = enhancements.find((y) => norm(y.name) === norm(t)) ?? (cat.enhancements ?? []).find((y) => norm(y.name) === norm(t))
      if (e) enhancementId = e.id
      const c = COUNT.exec(x.text)
      if (c && x.indent === top && !d.wargear.some((w) => norm(w) === norm(c[2]))) counted += Number(c[1])
    }
    let models = counted || d.minModels
    if (models < d.minModels || models > d.maxModels) {
      warnings.push(`${d.name}: ${models} models read, set to ${Math.min(d.maxModels, Math.max(d.minModels, models))}`)
      models = Math.min(d.maxModels, Math.max(d.minModels, models))
    }
    for (let i = 0; i < b.copies; i++) {
      l = addEntry(l, { datasheetId: d.id, models, ...(enhancementId ? { enhancementId } : {}), ...(warlord && i === 0 ? { warlord: true } : {}) }, ctx)
    }
  }
  if (!l.entries.length) warnings.push('No units recognised')
  return finish({ ...l, detachmentIds }, cat, nonEmpty, warnings)
}

const ROLE_ORDER = ['Epic Hero', 'Character', 'Battleline']

/** Shareable text, readable by listFromText. */
export function listToText(l: ArmyList, cat: Catalogue | undefined, editionLabel: string): string {
  const sheets = new Map((cat?.datasheets ?? []).map((d) => [d.id, d]))
  const enh = new Map((cat?.enhancements ?? []).map((x) => [x.id, x]))
  const pts = listPoints(l, sheets, enh)
  const size = cat ? battleSizes(cat).find((b) => b.id === l.battleSize) : undefined
  const dets = (l.detachmentIds ?? []).map((id) => cat?.detachments?.find((d) => d.id === id)?.name ?? 'Unknown detachment')
  const out = [`${l.name} (${pts.total} points)`]
  const faction = cat?.factions.find((f) => f.id === l.factionId)?.name
  if (faction) out.push(faction)
  out.push(`${editionLabel} · ${size ? `${size.name} (${l.pointsLimit} points)` : `${l.pointsLimit} points`}`)
  if (dets.length) out.push(`${dets.length > 1 ? 'Detachments' : 'Detachment'}: ${dets.join(', ')}`)

  const role = (d?: Datasheet) => (d ? (d.keywords.includes('Epic Hero') ? 'Epic Hero' : (d.role ?? 'Other')) : 'Other')
  const groups = new Map<string, typeof l.entries>()
  for (const e of l.entries) {
    const r = role(sheets.get(e.datasheetId))
    groups.set(r, [...(groups.get(r) ?? []), e])
  }
  const rank = (r: string) => (ROLE_ORDER.includes(r) ? ROLE_ORDER.indexOf(r) : ROLE_ORDER.length)
  for (const [r, entries] of [...groups].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))) {
    out.push('', r.toUpperCase())
    for (const e of entries) {
      const d = sheets.get(e.datasheetId)
      out.push(`${d?.name ?? 'Unknown unit'} (${pts.byEntry.get(e.id) ?? 0} points)`)
      if (e.warlord) out.push('  • Warlord')
      const x = e.enhancementId ? enh.get(e.enhancementId) : undefined
      if (x) out.push(`  • Enhancement: ${x.name} (+${x.points})`)
      out.push(`  • ${e.models}x ${e.models === 1 ? 'model' : 'models'}`)
    }
  }
  return out.join('\n') + '\n'
}

export const LIST_FILE_FORMAT = 'minitracker-list'

export function listToJson(l: ArmyList): string {
  return JSON.stringify({ format: LIST_FILE_FORMAT, version: 1, list: l }, null, 2)
}

/** A MiniTracker list file; gets a new id so importing twice gives two lists. */
export function listFromJson(text: string, ctx: Ctx): ImportResult {
  let raw: { format?: string; version?: number; list?: ArmyList }
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON')
  }
  if (raw?.format !== LIST_FILE_FORMAT || !raw.list) throw new Error('This file is not a MiniTracker list')
  if ((raw.version ?? 0) > 1) throw new Error('This list was made by a newer version of MiniTracker; update the app first')
  const list = { ...raw.list, id: ctx.newId(), createdAt: ctx.now, updatedAt: ctx.now }
  validateList(list)
  return { list, warnings: [] }
}
