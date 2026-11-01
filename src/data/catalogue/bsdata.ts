import { XMLParser } from 'fast-xml-parser'
import type { ArmyLimit, BattleSize, StatLine, WeaponProfile, Catalogue, CatalogueSource, Condition, ConditionOp, DataLimit, Datasheet, Detachment, DetachmentCount, Enhancement, Faction, KeywordMinimum, Muster, PointsStep, Rule } from '../../domain/catalogue/types'
import { evalCondition } from '../../domain/lists/conditions'
import { parseBsDataJson } from './bsdataJson'

/**
 * Converts BattleScribe data files (.gst + .cat XML, as published by BSData) into a compact Catalogue.
 * Reads units, sizes, points, keywords, wargear, abilities and the army-building limits that depend only on battle size.
 */

export interface SourceFile {
  name: string
  text: string
}

// Every element as an array, attributes as plain props: uniform access below.
type Node = Record<string, unknown> & { [k: string]: Node[] | string | undefined }

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  isArray: (_name, _jpath, _isLeaf, isAttribute) => !isAttribute,
})

const kids = (n: Node, container: string, tag: string): Node[] => {
  const c = n[container] as Node[] | undefined
  return (c?.[0]?.[tag] as Node[] | undefined) ?? []
}
const attr = (n: Node, key: string) => n[key] as string | undefined
const hidden = (n: Node) => attr(n, 'hidden') === 'true'
const isUnit = (n: Node) => ['unit', 'model'].includes(attr(n, 'type') ?? '')
const sortUnique = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b))

/** Text content of an element that may also carry attributes. */
const textOf = (v: unknown): string => {
  const x = Array.isArray(v) ? v[0] : v
  if (typeof x === 'string') return x.trim()
  if (x && typeof x === 'object' && '#text' in x) return String((x as Record<string, unknown>)['#text']).trim()
  return ''
}

/** Visit every element below `n` with its tag name. */
function walk(n: Node, visit: (tag: string, el: Node) => void) {
  for (const [key, val] of Object.entries(n)) {
    if (!Array.isArray(val)) continue
    for (const child of val) {
      if (child && typeof child === 'object') {
        visit(key, child as Node)
        walk(child as Node, visit)
      }
    }
  }
}

function readRules(root: Node, kind: Rule['kind'], factionId: string | undefined, into: Map<string, Rule>) {
  walk(root, (tag, el) => {
    if (tag !== 'rule' || hidden(el)) return
    const id = attr(el, 'id')
    const name = attr(el, 'name')
    if (!id || !name || into.has(id)) return
    const aliases = ((el.alias as unknown[] | undefined) ?? []).map(textOf).filter(Boolean)
    into.set(id, { id, name, text: textOf(el.description), kind, ...(factionId ? { factionId } : {}), ...(aliases.length ? { aliases } : {}) })
  })
}

interface CatInfo {
  id: string
  name: string
  library: boolean
  rootIds: string[]
  imports: string[]
}

export function parseBsData(files: SourceFile[], source: CatalogueSource): Catalogue {
  // XML (.gst/.cat) or JSON (.json, BSData's newer repositories): same structure once parsed.
  const parsed = files
    .filter((f) => /\.(gst|cat|json)$/i.test(f.name))
    .map((f) => ({ name: f.name, doc: (f.name.toLowerCase().endsWith('.json') ? parseBsDataJson(f.text) : parser.parse(f.text)) as Record<string, Node[]> }))
  const gstDoc = parsed.find((p) => p.doc.gameSystem)
  if (!gstDoc) throw new Error('No game system file found')
  const gst = gstDoc.doc.gameSystem[0]
  const ptsId = attr(kids(gst, 'costTypes', 'costType').find((c) => attr(c, 'name') === 'pts') ?? {}, 'id')

  const cats: CatInfo[] = []
  const entries = new Map<string, Node>()
  /** Every root/shared entry and group of any type, to follow links (e.g. to weapons). */
  const linkable = new Map<string, Node>()
  /** Entry links of root units by target id: links can carry their own limits. */
  const rootLinks = new Map<string, Node>()
  const rules = new Map<string, Rule>()
  readRules(gst, 'core', undefined, rules)

  for (const p of parsed.filter((x) => x.doc.catalogue)) {
    const c = p.doc.catalogue[0]
    const rootEntries = kids(c, 'selectionEntries', 'selectionEntry')
    for (const e of [...rootEntries, ...kids(c, 'sharedSelectionEntries', 'selectionEntry')]) {
      if (isUnit(e)) entries.set(attr(e, 'id')!, e)
      linkable.set(attr(e, 'id')!, e)
    }
    for (const g of kids(c, 'sharedSelectionEntryGroups', 'selectionEntryGroup')) linkable.set(attr(g, 'id')!, g)
    for (const pr of kids(c, 'sharedProfiles', 'profile')) linkable.set(attr(pr, 'id')!, pr)
    readRules(c, 'faction', attr(c, 'library') === 'true' ? undefined : attr(c, 'id'), rules)
    const links = kids(c, 'entryLinks', 'entryLink').filter((l) => !hidden(l) && attr(l, 'type') === 'selectionEntry')
    for (const l of links) if (!rootLinks.has(attr(l, 'targetId')!)) rootLinks.set(attr(l, 'targetId')!, l)
    cats.push({
      id: attr(c, 'id')!,
      name: attr(c, 'name')!,
      library: attr(c, 'library') === 'true',
      rootIds: [...rootEntries.filter((e) => !hidden(e)).map((e) => attr(e, 'id')!), ...links.map((l) => attr(l, 'targetId')!)],
      imports: kids(c, 'catalogueLinks', 'catalogueLink')
        .filter((l) => attr(l, 'importRootEntries') === 'true')
        .map((l) => attr(l, 'targetId')!),
    })
  }

  const byId = new Map(cats.map((c) => [c.id, c]))
  const rootsOf = (id: string, seen = new Set<string>()): string[] => {
    if (seen.has(id)) return []
    seen.add(id)
    const c = byId.get(id)
    return c ? [...c.rootIds, ...c.imports.flatMap((t) => rootsOf(t, seen))] : []
  }

  const factionCats = cats.filter((c) => !c.library)
  const factionsByEntry = new Map<string, Set<string>>()
  for (const c of factionCats) {
    for (const id of rootsOf(c.id)) {
      if (!entries.has(id)) continue
      if (!factionsByEntry.has(id)) factionsByEntry.set(id, new Set())
      factionsByEntry.get(id)!.add(c.id)
    }
  }

  const categoryNames = new Map<string, string>()
  for (const p of parsed) {
    const root = p.doc.gameSystem?.[0] ?? p.doc.catalogue?.[0]
    for (const ce of kids(root, 'categoryEntries', 'categoryEntry')) categoryNames.set(attr(ce, 'id')!, attr(ce, 'name')!)
  }
  const costIds = new Map(kids(gst, 'costTypes', 'costType').map((c) => [attr(c, 'name')!, attr(c, 'id')!]))
  const cond = conditionReader(categoryNames)
  const muster = readMuster(gst, cond, costIds)
  const sizeIds = new Set(muster.battleSizes.map((b) => b.id))
  // Some factions (e.g. Necrons) put a unit's limit on a keyword only that unit has, instead of on the unit.
  // Limits on keywords shared by several units (e.g. "Battlesuit") are other rules and are not read here.
  const categories = new Map<string, Node>()
  for (const p of parsed) {
    const root = p.doc.gameSystem?.[0] ?? p.doc.catalogue?.[0]
    for (const ce of kids(root, 'categoryEntries', 'categoryEntry')) if (!categories.has(attr(ce, 'id')!)) categories.set(attr(ce, 'id')!, ce)
  }
  const plainName = (e: Node) => (attr(e, 'name') ?? '').replace(/\s*\[Legends\]\s*/i, '').trim()
  const carriers = new Map<string, Set<string>>()
  for (const id of factionsByEntry.keys()) {
    for (const l of kids(entries.get(id)!, 'categoryLinks', 'categoryLink')) {
      const t = attr(l, 'targetId') ?? ''
      if (!carriers.has(t)) carriers.set(t, new Set())
      carriers.get(t)!.add(plainName(entries.get(id)!))
    }
  }
  const ownCategory = (e: Node): Node[] =>
    kids(e, 'categoryLinks', 'categoryLink')
      .map((l) => attr(l, 'targetId') ?? '')
      .filter((t) => carriers.get(t)?.size === 1)
      .map((t) => categories.get(t))
      .filter((c): c is Node => !!c)

  const datasheets: Datasheet[] = [...factionsByEntry].map(([id, facs]) => {
    const d = toDatasheet(entries.get(id)!, [...facs].sort(), ptsId)
    const e = entries.get(id)!
    const ruleIds = kids(e, 'infoLinks', 'infoLink')
      .filter((l) => attr(l, 'type') === 'rule' && !hidden(l))
      .map((l) => attr(l, 'targetId')!)
      .filter((rid) => rules.has(rid))
    const { keywords, stats, weapons } = readProfiles(e, linkable)
    const limit = armyLimit([e, rootLinks.get(id), ...ownCategory(e)].filter((x): x is Node => !!x), sizeIds)
    return { ...d, ...(ruleIds.length ? { ruleIds: [...new Set(ruleIds)] } : {}), ...(keywords.length ? { weaponKeywords: keywords } : {}), ...(stats.length ? { stats } : {}), ...(weapons.length ? { weapons } : {}), ...(limit ? { armyLimit: limit } : {}) }
  })
  datasheets.sort((a, b) => a.name.localeCompare(b.name))

  const factions: Faction[] = factionCats
    .map((c) => ({ id: c.id, name: c.name.split(' - ').at(-1)!.trim(), fullName: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const ruleList = [...rules.values()].sort((a, b) => Number(a.kind === 'faction') - Number(b.kind === 'faction') || a.name.localeCompare(b.name))
  const det = readDetachments(parsed, factionCats, byId, cond, costIds, muster.forceId)
  return { formatVersion: 5, gameId: attr(gst, 'id')!, gameName: attr(gst, 'name')!, source, factions, datasheets, rules: ruleList, muster, ...det }
}

/** Conditions of a modifier, flattened; undefined when they are combined in a way we don't read (nested groups, 'or'). */
function simpleConditions(m: Node): Node[] | undefined {
  const groups = kids(m, 'conditionGroups', 'conditionGroup')
  if (groups.length) return undefined
  if (kids(m, 'repeats', 'repeat').length) return undefined
  return kids(m, 'conditions', 'condition')
}

/** Battle size a condition tests for ("this roster has Incursion selected"), if that is all it tests. */
function battleSizeOf(c: Node, sizeIds: Set<string>): string | undefined {
  const id = attr(c, 'childId') ?? ''
  const t = attr(c, 'type')
  if (!sizeIds.has(id) || attr(c, 'field') !== 'selections') return undefined
  return (t === 'atLeast' || t === 'equalTo' || t === 'greaterThan') && Number(attr(c, 'value')) >= (t === 'greaterThan' ? 0 : 1) ? id : undefined
}

export function applyModifier(value: number, m: Node): number {
  const v = Number(attr(m, 'value'))
  switch (attr(m, 'type')) {
    case 'set':
      return v
    case 'increment':
      return value + v
    case 'decrement':
      return value - v
    default:
      return value
  }
}

/**
 * Most units of this datasheet an army may take: "max N selections" limits on the whole army (force/roster scope),
 * including changes that depend only on battle size. Changes with other conditions are skipped.
 */
function armyLimit(nodes: Node[], sizeIds: Set<string>): ArmyLimit | undefined {
  let base: number | undefined
  const bySize = new Map<string, number>()
  for (const n of nodes) {
    const mods = kids(n, 'modifiers', 'modifier')
    for (const c of kids(n, 'constraints', 'constraint')) {
      if (attr(c, 'type') !== 'max' || attr(c, 'field') !== 'selections' || !['force', 'roster'].includes(attr(c, 'scope') ?? '')) continue
      let max = Number(attr(c, 'value'))
      if (!(max >= 0)) continue
      const sizes = new Map<string, number>()
      // A limit changed by conditions we can't read (e.g. "0 unless detachment X") is skipped: better no check than a wrong one.
      let readable = true
      for (const m of mods.filter((x) => attr(x, 'field') === attr(c, 'id'))) {
        const conds = simpleConditions(m)
        const size = conds?.length === 1 ? battleSizeOf(conds[0], sizeIds) : undefined
        if (conds?.length === 0) max = applyModifier(max, m)
        else if (size) sizes.set(size, applyModifier(sizes.get(size) ?? max, m))
        else readable = false
      }
      if (!readable) continue
      for (const id of sizeIds) bySize.set(id, Math.min(bySize.get(id) ?? Infinity, sizes.get(id) ?? max))
      base = Math.min(base ?? Infinity, max)
    }
  }
  if (base === undefined) return undefined
  const diff = [...bySize].filter(([, v]) => v !== base)
  return { max: base, ...(diff.length ? { byBattleSize: Object.fromEntries(diff) } : {}) }
}

const OPS = new Set<ConditionOp>(['atLeast', 'atMost', 'equalTo', 'notEqualTo', 'lessThan', 'greaterThan', 'instanceOf', 'notInstanceOf'])

/** Turns a modifier's conditions into a Condition (undefined when it uses something we don't read, e.g. repeats). */
function conditionReader(categoryNames: Map<string, string>) {
  const leaf = (c: Node): Condition | undefined => {
    const op = attr(c, 'type') as ConditionOp
    if (!OPS.has(op)) return undefined
    const id = attr(c, 'childId') ?? ''
    const value = Number(attr(c, 'value') ?? 0)
    return categoryNames.has(id) ? { op, value, keyword: categoryNames.get(id)! } : { op, value, id }
  }
  const group = (n: Node, type: 'and' | 'or'): Condition | undefined => {
    const parts: (Condition | undefined)[] = [
      ...kids(n, 'conditions', 'condition').map(leaf),
      ...kids(n, 'conditionGroups', 'conditionGroup').map((g) => group(g, attr(g, 'type') === 'or' ? 'or' : 'and')),
    ]
    if (parts.some((x) => !x)) return undefined
    const list = parts as Condition[]
    return list.length === 1 ? list[0] : type === 'or' ? { any: list } : { all: list }
  }
  return (m: Node): Condition | null | undefined => {
    if (kids(m, 'repeats', 'repeat').length) return undefined
    if (!kids(m, 'conditions', 'condition').length && !kids(m, 'conditionGroups', 'conditionGroup').length) return null
    return group(m, 'and')
  }
}
type CondReader = ReturnType<typeof conditionReader>

/** A "max" constraint with the modifiers that change it; modifiers we can't read are left out. */
function dataLimit(c: Node, mods: Node[], cond: CondReader): DataLimit {
  const modifiers = mods
    .filter((m) => attr(m, 'field') === attr(c, 'id') && ['set', 'increment', 'decrement'].includes(attr(m, 'type') ?? ''))
    .flatMap((m) => {
      const when = cond(m)
      if (when === undefined) return []
      return [{ type: attr(m, 'type') as 'set', value: Number(attr(m, 'value')), ...(when ? { when } : {}) }]
    })
  return { max: Number(attr(c, 'value')), modifiers }
}

/** Battle sizes, keyword minimums and detachment/enhancement budgets from the game system's main force (BSData 40k: "Army Roster"). */
function readMuster(gst: Node, cond: CondReader, costIds: Map<string, string>): Muster {
  const battleSizes: BattleSize[] = []
  walk(gst, (tag, el) => {
    if (tag !== 'selectionEntryGroup' || attr(el, 'name') !== 'Battle Size') return
    for (const s of kids(el, 'selectionEntries', 'selectionEntry')) {
      const name = attr(s, 'name') ?? ''
      const pts = /\((\d+) Points? limit\)/i.exec(name)
      if (!pts || battleSizes.some((b) => b.id === attr(s, 'id'))) continue
      battleSizes.push({ id: attr(s, 'id')!, name: name.replace(/^\d+\.\s*/, '').replace(/\s*\(.*\)\s*$/, ''), pointsLimit: Number(pts[1]) })
    }
  })
  battleSizes.sort((a, b) => a.pointsLimit - b.pointsLimit)

  const forces = kids(gst, 'forceEntries', 'forceEntry').filter((f) => !hidden(f))
  const main = forces.find((f) => attr(f, 'name') === 'Army Roster') ?? forces.find((f) => !/crusade|boarding/i.test(attr(f, 'name') ?? ''))
  const keywordMinimums: KeywordMinimum[] = []
  for (const cl of main ? kids(main, 'categoryLinks', 'categoryLink') : []) {
    const mods = kids(cl, 'modifiers', 'modifier')
    for (const c of kids(cl, 'constraints', 'constraint')) {
      if (attr(c, 'type') !== 'min' || attr(c, 'field') !== 'selections' || Number(attr(c, 'value')) < 1) continue
      // "Set to 0 when the army's faction is X" → X is exempt.
      const exempt = new Set<string>()
      for (const m of mods.filter((x) => attr(x, 'field') === attr(c, 'id') && attr(x, 'type') === 'set' && Number(attr(x, 'value')) === 0)) {
        const conds = [...kids(m, 'conditions', 'condition'), ...kids(m, 'conditionGroups', 'conditionGroup').flatMap((g) => kids(g, 'conditions', 'condition'))]
        for (const k of conds) if (attr(k, 'scope') === 'primary-catalogue' && attr(k, 'type') === 'instanceOf') exempt.add(attr(k, 'childId')!)
      }
      keywordMinimums.push({ keyword: attr(cl, 'name')!, min: Number(attr(c, 'value')), exemptFactionIds: [...exempt].sort() })
    }
  }
  const out: Muster = { battleSizes, keywordMinimums }
  if (main) {
    out.forceId = attr(main, 'id')
    const mods = kids(main, 'modifiers', 'modifier')
    for (const c of kids(main, 'constraints', 'constraint')) {
      if (attr(c, 'type') !== 'max') continue
      if (attr(c, 'field') === costIds.get('Detachment Points')) out.detachmentPoints = dataLimit(c, mods, cond)
      if (attr(c, 'field') === costIds.get('Enhancements')) out.enhancements = dataLimit(c, mods, cond)
    }
  }
  return out
}

/** Hidden in an Army Roster that has only `present` chosen (e.g. Boarding Actions-only detachments are)? */
function hiddenInArmy(n: Node, cond: CondReader, present: (string | undefined)[]): boolean {
  if (hidden(n)) return true
  return kids(n, 'modifiers', 'modifier').some((m) => {
    if (attr(m, 'field') !== 'hidden' || attr(m, 'type') !== 'set' || attr(m, 'value') !== 'true') return false
    const when = cond(m)
    if (when === undefined) return false
    return when === null || evalCondition(when, (x) => (x.id && present.includes(x.id) ? 1 : 0))
  })
}

/** Ids anywhere in a node's modifier conditions. */
function conditionIds(n: Node): string[] {
  const out: string[] = []
  for (const m of kids(n, 'modifiers', 'modifier')) {
    walk(m, (tag, el) => {
      if (tag === 'condition' && attr(el, 'childId')) out.push(attr(el, 'childId')!)
    })
  }
  return out
}

/**
 * Detachments, their enhancements, and how many detachments each faction takes.
 * A faction's detachments are found by following its "Detachment" entry or group, through links into any file
 * (some factions keep them in a library). An enhancement belongs to the detachment its hidden-unless condition names.
 */
function readDetachments(
  parsed: { doc: Record<string, Node[]> }[],
  factionCats: CatInfo[],
  byId: Map<string, CatInfo>,
  cond: CondReader,
  costIds: Map<string, string>,
  forceId: string | undefined,
): Pick<Catalogue, 'detachments' | 'enhancements' | 'detachmentCounts'> {
  const cost = (n: Node, name: string) => Number(attr(kids(n, 'costs', 'cost').find((c) => attr(c, 'typeId') === costIds.get(name)) ?? {}, 'value') ?? 0)
  const targets = new Map<string, Node>()
  const catDocs = parsed.map((p) => p.doc.catalogue?.[0]).filter((c): c is Node => !!c)
  for (const c of catDocs) {
    for (const e of [...kids(c, 'sharedSelectionEntries', 'selectionEntry'), ...kids(c, 'selectionEntries', 'selectionEntry')]) targets.set(attr(e, 'id')!, e)
    for (const g of kids(c, 'sharedSelectionEntryGroups', 'selectionEntryGroup')) targets.set(attr(g, 'id')!, g)
  }
  const isDetachmentNode = (n: Node) => attr(n, 'name') === 'Detachment'

  const detachments = new Map<string, Detachment>()
  const detachmentCounts: Record<string, DetachmentCount> = {}
  for (const f of factionCats) {
    // Like BattleScribe: the faction's own entries plus the root entries of catalogues it imports.
    const closure = (id: string, seen = new Set<string>()): string[] => {
      if (seen.has(id)) return []
      seen.add(id)
      return [id, ...(byId.get(id)?.imports ?? []).flatMap((t) => closure(t, seen))]
    }
    const starts: Node[] = []
    for (const cid of closure(f.id)) {
      const doc = catDocs.find((c) => attr(c, 'id') === cid)
      if (!doc) continue
      walk(doc, (tag, el) => {
        if (isDetachmentNode(el) && ['selectionEntry', 'selectionEntryGroup', 'entryLink'].includes(tag)) starts.push(el)
      })
    }
    const seen = new Set<Node>()
    const visit = (n: Node | undefined, depth: number) => {
      if (!n || seen.has(n) || depth > 6 || hidden(n)) return
      seen.add(n)
      if (attr(n, 'targetId') !== undefined && attr(n, 'type') !== 'upgrade') return visit(targets.get(attr(n, 'targetId')!), depth + 1)
      if (isDetachmentNode(n) && attr(n, 'type') === undefined && !detachmentCounts[f.id]) {
        const cons = kids(n, 'constraints', 'constraint').filter((k) => attr(k, 'field') === 'selections')
        const min = cons.find((k) => attr(k, 'type') === 'min')
        const max = cons.find((k) => attr(k, 'type') === 'max')
        detachmentCounts[f.id] = { min: min ? Number(attr(min, 'value')) : 0, max: max ? dataLimit(max, kids(n, 'modifiers', 'modifier'), cond) : { max: -1, modifiers: [] } }
      }
      if (attr(n, 'type') === 'upgrade' && !isDetachmentNode(n)) {
        if (hiddenInArmy(n, cond, [forceId])) return
        const cur = detachments.get(attr(n, 'id')!) ?? {
          id: attr(n, 'id')!,
          name: attr(n, 'name')!,
          factionIds: [],
          detachmentPoints: cost(n, 'Detachment Points'),
          keywords: sortUnique(kids(n, 'categoryLinks', 'categoryLink').map((l) => attr(l, 'name')!)),
        }
        if (!cur.factionIds.includes(f.id)) cur.factionIds.push(f.id)
        detachments.set(cur.id, cur)
        return
      }
      for (const c of [...kids(n, 'selectionEntries', 'selectionEntry'), ...kids(n, 'selectionEntryGroups', 'selectionEntryGroup'), ...kids(n, 'entryLinks', 'entryLink')]) visit(c, depth + 1)
    }
    for (const s0 of starts) visit(s0, 0)
  }

  const enhancements = new Map<string, Enhancement>()
  for (const c of catDocs) {
    walk(c, (tag, g) => {
      if (tag !== 'selectionEntryGroup' || !/enhancement/i.test(attr(g, 'name') ?? '') || hidden(g)) return
      const groupDet = conditionIds(g).find((id) => detachments.has(id))
      for (const e of kids(g, 'selectionEntries', 'selectionEntry')) {
        if (attr(e, 'type') !== 'upgrade' || hidden(e) || enhancements.has(attr(e, 'id')!)) continue
        const detachmentId = conditionIds(e).find((id) => detachments.has(id)) ?? groupDet
        // Visibility conditions are skipped: besides "this detachment is chosen" they say which units may take it.
        // Boarding Actions enhancements drop out because their detachments are not in the list.
        if (!detachmentId) continue
        enhancements.set(attr(e, 'id')!, { id: attr(e, 'id')!, name: attr(e, 'name')!, points: cost(e, 'pts'), detachmentId })
      }
    })
  }

  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)
  for (const d of detachments.values()) d.factionIds.sort()
  return { detachments: [...detachments.values()].sort(byName), enhancements: [...enhancements.values()].sort(byName), detachmentCounts }
}

function toDatasheet(e: Node, factionIds: string[], ptsId: string | undefined): Datasheet {
  const rawName = attr(e, 'name')!
  const legends = /\[Legends\]/i.test(rawName)
  const name = rawName.replace(/\s*\[Legends\]\s*/i, '').trim()

  const cats = kids(e, 'categoryLinks', 'categoryLink')
  const catNames = cats.map((c) => attr(c, 'name')!)
  const factionKeywords = sortUnique(catNames.filter((n) => n.startsWith('Faction: ')).map((n) => n.slice(9)))
  const keywords = sortUnique(catNames.filter((n) => !n.startsWith('Faction: ') && n !== name))
  const role = attr(cats.find((c) => attr(c, 'primary') === 'true') ?? {}, 'name')

  const abilityProfiles = kids(e, 'profiles', 'profile').filter((p) => attr(p, 'typeName') === 'Abilities' && !hidden(p))
  const abilities = abilityProfiles.map((p) => attr(p, 'name')!)
  const abilityTexts: Record<string, string> = {}
  for (const p of abilityProfiles) {
    const desc = kids(p, 'characteristics', 'characteristic').find((ch) => attr(ch, 'name') === 'Description')
    const text = desc ? textOf(desc) : ''
    if (text) abilityTexts[attr(p, 'name')!] = text
  }
  const [rawMin, maxModels] = modelCount(e, true)
  const minModels = Math.max(1, Math.min(rawMin, maxModels))

  return {
    id: attr(e, 'id')!,
    name,
    factionIds,
    ...(role ? { role } : {}),
    keywords,
    factionKeywords,
    minModels,
    maxModels,
    points: pointsSteps(e, ptsId, minModels, maxModels),
    wargear: sortUnique(collectWargear(e)),
    abilities: sortUnique(abilities),
    legends,
    ...(Object.keys(abilityTexts).length ? { abilityTexts } : {}),
  }
}

/** [min, max] from "selections" constraints on model entries and their groups. */
function modelCount(n: Node, isRoot: boolean): [number, number] {
  const own = (type: 'min' | 'max') => {
    const c = kids(n, 'constraints', 'constraint').find(
      (k) => attr(k, 'type') === type && attr(k, 'field') === 'selections' && attr(k, 'scope') === 'parent',
    )
    return c ? Number(attr(c, 'value')) : undefined
  }
  if (attr(n, 'type') === 'model' && !isRoot) return [own('min') ?? 0, own('max') ?? 0]

  let min = 0
  let max = 0
  for (const child of [...kids(n, 'selectionEntries', 'selectionEntry'), ...kids(n, 'selectionEntryGroups', 'selectionEntryGroup')]) {
    if (attr(child, 'type') === 'upgrade') continue
    const [a, b] = modelCount(child, false)
    min += a
    max += b
  }
  const isGroup = attr(n, 'type') === undefined
  if (isGroup && max > 0) {
    min = own('min') ?? min
    max = own('max') ?? max
  }
  if (isRoot && max === 0) return [1, 1]
  return [min, max]
}

const ptsOf = (n: Node, ptsId: string | undefined) => Number(attr(kids(n, 'costs', 'cost').find((c) => attr(c, 'typeId') === ptsId) ?? {}, 'value') ?? 0)

/** Model entries anywhere under a unit (not inside other models), with their own count limits. */
function modelEntries(n: Node): Node[] {
  const out: Node[] = []
  for (const c of [...kids(n, 'selectionEntries', 'selectionEntry'), ...kids(n, 'selectionEntryGroups', 'selectionEntryGroup')]) {
    if (attr(c, 'type') === 'model') out.push(c)
    else if (attr(c, 'type') !== 'upgrade') out.push(...modelEntries(c))
  }
  return out
}

function pointsSteps(e: Node, ptsId: string | undefined, minModels: number, maxModels: number): PointsStep[] {
  const base = ptsOf(e, ptsId)
  const priced = attr(e, 'type') === 'unit' ? modelEntries(e).filter((m) => ptsOf(m, ptsId) > 0) : []
  if (priced.length > 0) {
    // Per-model pricing: forced models are part of the base price, extra models add their own cost.
    const limits = (m: Node, t: 'min' | 'max') =>
      Number(attr(kids(m, 'constraints', 'constraint').find((k) => attr(k, 'type') === t && attr(k, 'field') === 'selections') ?? {}, 'value') ?? 0)
    const fixed = base + priced.reduce((sum, m) => sum + limits(m, 'min') * ptsOf(m, ptsId), 0)
    const extra = priced.find((m) => limits(m, 'max') > limits(m, 'min'))
    const per = extra ? ptsOf(extra, ptsId) : 0
    const steps: PointsStep[] = []
    for (let n = minModels; n <= maxModels; n++) steps.push({ fromModels: n, points: fixed + (n - minModels) * per })
    return per === 0 ? steps.slice(0, 1) : steps
  }
  const steps: PointsStep[] = [{ fromModels: minModels, points: base }]
  const id = attr(e, 'id')
  for (const m of kids(e, 'modifiers', 'modifier')) {
    if (attr(m, 'type') !== 'set' || attr(m, 'field') !== ptsId) continue
    const conds = kids(m, 'conditions', 'condition')
    if (conds.length !== 1) continue
    const c = conds[0]
    const scope = attr(c, 'scope')
    if (attr(c, 'field') !== 'selections' || !(scope === id || scope === 'self' || scope === 'parent' || scope === 'unit')) continue
    const v = Number(attr(c, 'value'))
    const from = { atLeast: v, greaterThan: v + 1, equalTo: v }[attr(c, 'type') ?? '']
    if (from !== undefined) steps.push({ fromModels: from, points: Number(attr(m, 'value')) })
  }
  return steps.sort((a, b) => a.fromModels - b.fromModels).filter((s, i, all) => i === 0 || s.fromModels !== all[i - 1].fromModels)
}

function collectWargear(n: Node): string[] {
  const out: string[] = []
  for (const s of kids(n, 'selectionEntries', 'selectionEntry')) {
    if (hidden(s)) continue
    if (attr(s, 'type') === 'upgrade') out.push(attr(s, 'name')!)
    out.push(...collectWargear(s))
  }
  for (const g of kids(n, 'selectionEntryGroups', 'selectionEntryGroup')) out.push(...collectWargear(g))
  for (const l of kids(n, 'entryLinks', 'entryLink')) {
    if (!hidden(l) && attr(l, 'type') === 'selectionEntry') out.push(attr(l, 'name')!)
  }
  return out
}

/**
 * Profiles under a unit, following links to shared weapons: stat lines ("Unit"), weapon profiles, and the weapon
 * keywords ("Assault", "Sustained Hits 1"…) used to explain weapon abilities.
 */
function readProfiles(e: Node, linkable: Map<string, Node>): { keywords: string[]; stats: StatLine[]; weapons: WeaponProfile[] } {
  const out = new Set<string>()
  const stats = new Map<string, StatLine>()
  const weapons = new Map<string, WeaponProfile>()
  const seen = new Set<string>()
  const row = (el: Node): [string, string][] => kids(el, 'characteristics', 'characteristic').map((ch) => [attr(ch, 'name')!, textOf(ch) || '-'])
  const visit = (n: Node) => {
    walk(n, (tag, el) => {
      if (tag === 'profile' && !hidden(el)) {
        const type = attr(el, 'typeName') ?? ''
        const name = attr(el, 'name')!
        if (type === 'Unit' && !stats.has(name)) stats.set(name, { name, values: row(el) })
        if (type.includes('Weapons')) {
          const kind = type.startsWith('Melee') ? 'melee' : 'ranged'
          if (!weapons.has(`${kind}:${name}`)) weapons.set(`${kind}:${name}`, { name, kind, values: row(el) })
          const kw = kids(el, 'characteristics', 'characteristic').find((ch) => attr(ch, 'name') === 'Keywords')
          for (const k of (kw ? textOf(kw) : '').split(',')) {
            const t = k.trim()
            if (t && t !== '-') out.add(t)
          }
        }
      }
      // Shared profiles (often the unit's stat line) are reached through info links.
      if (tag === 'infoLink' && !hidden(el) && attr(el, 'type') === 'profile') {
        const target = linkable.get(attr(el, 'targetId') ?? '')
        if (target && !seen.has(attr(el, 'targetId')!)) {
          seen.add(attr(el, 'targetId')!)
          visit({ profiles: [{ profile: [target] }] } as unknown as Node)
        }
      }
      // Follow links to single entries (the unit's weapons), not to shared groups such as Crusade
      // "Weapon Modifications", which list many weapons the unit can't take.
      if (tag === 'entryLink' && !hidden(el) && attr(el, 'type') === 'selectionEntry') {
        const target = linkable.get(attr(el, 'targetId') ?? '')
        const tid = attr(el, 'targetId')!
        if (target && !seen.has(tid)) {
          seen.add(tid)
          visit(target)
        }
      }
    })
  }
  visit(e)
  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)
  return { keywords: sortUnique([...out]), stats: [...stats.values()], weapons: [...weapons.values()].sort((a, b) => a.kind.localeCompare(b.kind) || byName(a, b)) }
}
