import { XMLParser } from 'fast-xml-parser'
import type { ArmyLimit, BattleSize, LoadoutChoice, LoadoutOption, ModelType, StatLine, WeaponProfile, Catalogue, CatalogueSource, Condition, ConditionOp, DataLimit, Datasheet, Detachment, DetachmentCount, Enhancement, Faction, KeywordMinimum, Muster, PointsStep, Rule } from '../../domain/catalogue/types'
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
    const d = toDatasheet(entries.get(id)!, [...facs].sort(), ptsId, linkable)
    const e = entries.get(id)!
    const ruleIds = kids(e, 'infoLinks', 'infoLink')
      .filter((l) => attr(l, 'type') === 'rule' && !hidden(l))
      .map((l) => attr(l, 'targetId')!)
      .filter((rid) => rules.has(rid))
    const { keywords, stats, weapons } = readProfiles(e, linkable)
    const limit = armyLimit([e, rootLinks.get(id), ...ownCategory(e)].filter((x): x is Node => !!x), sizeIds)
    const leads = readLeads(e, categoryNames)
    const models = readModels(e, linkable)
    const maxLeaders = kids(e, 'constraints', 'constraint')
      .filter((k) => attr(k, 'type') === 'max' && attr(k, 'field') === 'associations')
      .map((k) => Number(attr(k, 'value')))
      .reduce<number | undefined>((m, v) => (m === undefined ? v : Math.max(m, v)), undefined)
    return { ...d, ...(ruleIds.length ? { ruleIds: [...new Set(ruleIds)] } : {}), ...(keywords.length ? { weaponKeywords: keywords } : {}), ...(stats.length ? { stats } : {}), ...(weapons.length ? { weapons } : {}), ...(limit ? { armyLimit: limit } : {}), ...(leads ? { leads } : {}), ...(models.length ? { models } : {}), ...(maxLeaders !== undefined && maxLeaders !== 1 ? { maxLeaders } : {}) }
  })
  datasheets.sort((a, b) => a.name.localeCompare(b.name))

  const factions: Faction[] = factionCats
    .map((c) => ({ id: c.id, name: c.name.split(' - ').at(-1)!.trim(), fullName: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const ruleList = [...rules.values()].sort((a, b) => Number(a.kind === 'faction') - Number(b.kind === 'faction') || a.name.localeCompare(b.name))
  const det = readDetachments(parsed, factionCats, byId, cond, costIds, muster.forceId)
  return { formatVersion: 7, gameId: attr(gst, 'id')!, gameName: attr(gst, 'name')!, source, factions, datasheets, rules: ruleList, muster, ...det }
}

/** Conditions of a modifier, flattened; undefined when they are combined in a way we don't read (nested groups, 'or'). */
function simpleConditions(m: Node): Node[] | undefined {
  const groups = kids(m, 'conditionGroups', 'conditionGroup')
  if (groups.length) return undefined
  if (kids(m, 'repeats', 'repeat').length) return undefined
  return kids(m, 'conditions', 'condition')
}

/** Limits of an entry or link on its parent: [min, max]; missing max = `open`. */
function parentLimits(n: Node, open: number): [number, number] {
  const c = kids(n, 'constraints', 'constraint').filter((k) => attr(k, 'field') === 'selections' && attr(k, 'scope') === 'parent')
  const v = (t: string) => c.find((k) => attr(k, 'type') === t)
  return [Number(attr(v('min') ?? {}, 'value') ?? 0), v('max') ? Number(attr(v('max')!, 'value')) : open]
}

/**
 * Model types of a unit with their wargear: fixed items (min = max) and choices (groups with min/max and options).
 * Groups without limits (e.g. "Wargear") are looked through. A unit that is a single model is its own model type.
 */
function readModels(e: Node, linkable: Map<string, Node>): ModelType[] {
  const children = (n: Node): { node: Node; target: Node; isLink: boolean }[] => [
    ...kids(n, 'selectionEntries', 'selectionEntry').map((x) => ({ node: x, target: x, isLink: false })),
    ...kids(n, 'selectionEntryGroups', 'selectionEntryGroup').map((x) => ({ node: x, target: x, isLink: false })),
    ...kids(n, 'entryLinks', 'entryLink').flatMap((l) => {
      const t = linkable.get(attr(l, 'targetId') ?? '')
      return t && !hidden(l) ? [{ node: l, target: t, isLink: true }] : []
    }),
  ]
  const options = (g: Node): LoadoutOption[] =>
    children(g).flatMap(({ node, target, isLink }) => {
      if (hidden(node) || NOT_WARGEAR(attr(node, 'name') ?? '')) return []
      if (attr(target, 'type') === 'upgrade') return [{ id: attr(node, 'id')!, ...(isLink ? { targetId: attr(target, 'id')! } : {}), name: attr(node, 'name')!, max: parentLimits(node, 1)[1] }]
      if (attr(target, 'type') === undefined && !NOT_WARGEAR_GROUP.test(attr(target, 'name') ?? '')) return options(target)
      return []
    })

  const readModel = (m: Node, limits: [number, number]): ModelType => {
    const fixed: string[] = []
    const choices: LoadoutChoice[] = []
    const visit = (n: Node) => {
      for (const { node, target } of children(n)) {
        const name = attr(node, 'name') ?? ''
        if (hidden(node) || NOT_WARGEAR(name) || NOT_WARGEAR_GROUP.test(name)) continue
        const [min, max] = parentLimits(node, Infinity)
        if (attr(target, 'type') === 'upgrade') {
          if (min >= 1 && min === max) fixed.push(name)
          else choices.push({ id: attr(node, 'id')!, name, min, max: Number.isFinite(max) ? max : 1, options: [{ id: attr(node, 'id')!, name, max: Number.isFinite(max) ? max : 1 }] })
        } else if (attr(target, 'type') === undefined) {
          const hasLimits = kids(node, 'constraints', 'constraint').some((k) => attr(k, 'field') === 'selections') || kids(target, 'constraints', 'constraint').some((k) => attr(k, 'field') === 'selections')
          if (!hasLimits) {
            visit(target)
            continue
          }
          const [gmin, gmax] = parentLimits(kids(node, 'constraints', 'constraint').length ? node : target, Infinity)
          const opts = options(target)
          if (!opts.length) continue
          // One option that must be taken is not a choice.
          if (opts.length === 1 && gmin >= 1 && gmin === gmax) {
            fixed.push(opts[0].name)
            continue
          }
          const def = attr(target, 'defaultSelectionEntryId')
          choices.push({ id: attr(node, 'id')!, name, min: gmin, max: Number.isFinite(gmax) ? gmax : opts.reduce((a, o) => a + o.max, 0), ...(def && opts.some((o) => o.id === def) ? { defaultId: def } : {}), options: opts })
        }
      }
    }
    visit(m)
    return { id: attr(m, 'id')!, name: attr(m, 'name')!, min: limits[0], max: limits[1], fixed: sortUnique(fixed), choices }
  }

  if (attr(e, 'type') === 'model') return [readModel(e, [1, 1])]
  const hasModels = (n: Node, depth: number): boolean => depth < 5 && children(n).some((c) => attr(c.target, 'type') === 'model' || (attr(c.target, 'type') !== 'upgrade' && hasModels(c.target, depth + 1)))
  // Model entries anywhere under the unit (through groups, size options and links), not inside other models.
  const found = new Map<string, ModelType>()
  const walkModels = (n: Node, depth: number) => {
    if (depth > 6) return
    for (const { node, target } of children(n)) {
      if (hidden(node) || NOT_WARGEAR_GROUP.test(attr(node, 'name') ?? '')) continue
      if (attr(target, 'type') === 'model') {
        const [min, max] = parentLimits(node, OPEN)
        // The same model in several size options (as one entry, or as copies with the same name): widest limits.
        const key = attr(target, 'name')!
        const cur = found.get(key)
        found.set(key, cur ? { ...cur, min: Math.min(cur.min, min), max: Math.max(cur.max, max) } : readModel(target, [min, max]))
      } else if (attr(target, 'type') !== 'upgrade' || hasModels(target, 0)) walkModels(target, depth + 1)
    }
  }
  walkModels(e, 0)
  return [...found.values()].map((m) => (m.max >= OPEN ? { ...m, max: 99 } : m))
}

/** A Leader's "Leading" association: the units (ids) or keywords it may be attached to. */
function readLeads(e: Node, categoryNames: Map<string, string>): { ids: string[]; keywords: string[] } | undefined {
  const assoc = kids(e, 'associations', 'association').filter((a) => /lead/i.test(`${attr(a, 'name')} ${attr(a, 'label')}`))
  if (!assoc.length) return undefined
  const ids = new Set<string>()
  const keywords = new Set<string>()
  for (const a of assoc) {
    walk(a, (tag, c) => {
      if (tag !== 'condition' || attr(c, 'type') !== 'instanceOf') return
      const id = attr(c, 'childId') ?? ''
      if (categoryNames.has(id)) keywords.add(categoryNames.get(id)!)
      else if (id) ids.add(id)
    })
  }
  return { ids: [...ids].sort(), keywords: [...keywords].sort() }
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

/** BattleScribe scopes that point at the unit an entry sits in, not at the army. */
const UNIT_SCOPES = new Set(['parent', 'ancestor', 'root-entry', 'self', 'unit'])

const OPS = new Set<ConditionOp>(['atLeast', 'atMost', 'equalTo', 'notEqualTo', 'lessThan', 'greaterThan', 'instanceOf', 'notInstanceOf'])

/** Turns a modifier's conditions into a Condition (undefined when it uses something we don't read, e.g. repeats). */
function conditionReader(categoryNames: Map<string, string>) {
  const leaf = (c: Node): Condition | undefined => {
    const op = attr(c, 'type') as ConditionOp
    if (!OPS.has(op)) return undefined
    const id = attr(c, 'childId') ?? ''
    const value = Number(attr(c, 'value') ?? 0)
    const unit = UNIT_SCOPES.has(attr(c, 'scope') ?? '') ? { unit: true as const } : {}
    return categoryNames.has(id) ? { op, value, keyword: categoryNames.get(id)!, ...unit } : { op, value, id, ...unit }
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
        // "Hidden when …" of the group and the enhancement: tells which units can't take it.
        const hides = [g, e].flatMap((n) => kids(n, 'modifiers', 'modifier').filter((m) => attr(m, 'field') === 'hidden' && attr(m, 'type') === 'set' && attr(m, 'value') === 'true'))
        const conds = hides.map((m) => cond(m)).filter((x): x is Condition => !!x)
        const notFor = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : { any: conds }
        enhancements.set(attr(e, 'id')!, { id: attr(e, 'id')!, name: attr(e, 'name')!, points: cost(e, 'pts'), detachmentId, ...(notFor ? { notFor } : {}) })
      }
    })
  }

  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)
  for (const d of detachments.values()) d.factionIds.sort()
  return { detachments: [...detachments.values()].sort(byName), enhancements: [...enhancements.values()].sort(byName), detachmentCounts }
}

function toDatasheet(e: Node, factionIds: string[], ptsId: string | undefined, linkable: Map<string, Node>): Datasheet {
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
  const [rawMin, maxModels] = modelCount(e, true, linkable)
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
/** "No limit of its own": a model whose count is set by the group around it (e.g. "4-9 Hearthguard"). */
const OPEN = 1000

/**
 * [min, max] models of a unit, from "selections" constraints on model entries and their groups.
 * Handles size options (upgrades that each contain models: pick one), models reached through entry links (the link
 * carries the count), and models without a limit of their own inside a limited group.
 */
function modelCount(n: Node, isRoot: boolean, linkable: Map<string, Node>): [number, number] {
  const own = (type: 'min' | 'max') => {
    const c = kids(n, 'constraints', 'constraint').find(
      (k) => attr(k, 'type') === type && attr(k, 'field') === 'selections' && attr(k, 'scope') === 'parent',
    )
    return c ? Number(attr(c, 'value')) : undefined
  }
  if (attr(n, 'type') === 'model' && !isRoot) return [own('min') ?? 0, own('max') ?? OPEN]

  let min = 0
  let max = 0
  const options: [number, number][] = []
  const children = [
    ...kids(n, 'selectionEntries', 'selectionEntry'),
    ...kids(n, 'selectionEntryGroups', 'selectionEntryGroup'),
    // A link to a model counts as that model, with the link's own limits.
    ...kids(n, 'entryLinks', 'entryLink').flatMap((l) => {
      const t = linkable.get(attr(l, 'targetId') ?? '')
      return t && !hidden(l) && attr(t, 'type') === 'model' ? [{ ...t, constraints: l.constraints } as Node] : []
    }),
  ]
  for (const child of children) {
    const named = attr(child, 'type') === 'upgrade' ? /^(\d+)\s+models?$/i.exec(attr(child, 'name') ?? '') : null
    const [a, b] = named ? [Number(named[1]), Number(named[1])] : modelCount(child, false, linkable)
    if (attr(child, 'type') === 'upgrade') {
      if (b > 0 && b < OPEN) options.push([a, b])
      continue
    }
    min += a
    max += b
  }
  if (options.length) {
    min += Math.min(...options.map((o) => o[0]))
    max += Math.max(...options.map((o) => o[1]))
    if (attr(n, 'type') === undefined) return [min, Math.min(max, OPEN)]
  }
  const isGroup = attr(n, 'type') === undefined
  if (isGroup && max > 0) {
    min = own('min') ?? min
    max = own('max') ?? max
  }
  max = Math.min(max, OPEN)
  if (isRoot && (max === 0 || max >= OPEN)) return [Math.max(1, min), Math.max(1, min)]
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

/** Not wargear: army-building and Crusade entries that sit among a unit's options. */
const NOT_WARGEAR = (name: string) => name === 'Warlord' || /\bupgrade$/i.test(name)
const NOT_WARGEAR_GROUP = /^(crusade|enhancements?\b)/i

function collectWargear(n: Node): string[] {
  const out: string[] = []
  for (const s of kids(n, 'selectionEntries', 'selectionEntry')) {
    if (hidden(s)) continue
    if (attr(s, 'type') === 'upgrade' && !NOT_WARGEAR(attr(s, 'name')!)) out.push(attr(s, 'name')!)
    out.push(...collectWargear(s))
  }
  for (const g of kids(n, 'selectionEntryGroups', 'selectionEntryGroup')) if (!NOT_WARGEAR_GROUP.test(attr(g, 'name') ?? '')) out.push(...collectWargear(g))
  for (const l of kids(n, 'entryLinks', 'entryLink')) {
    if (!hidden(l) && attr(l, 'type') === 'selectionEntry' && !NOT_WARGEAR(attr(l, 'name')!)) out.push(attr(l, 'name')!)
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
