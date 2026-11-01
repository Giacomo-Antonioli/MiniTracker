import { XMLParser } from 'fast-xml-parser'
import type { Catalogue, CatalogueSource, Datasheet, Faction, PointsStep, Rule } from '../../domain/catalogue/types'
import { parseBsDataJson } from './bsdataJson'

/**
 * Converts BattleScribe data files (.gst + .cat XML, as published by BSData) into a compact Catalogue.
 * Reads units, sizes, points, keywords, wargear and abilities. Full list-building rules come later (v0.4).
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
    readRules(c, 'faction', attr(c, 'library') === 'true' ? undefined : attr(c, 'id'), rules)
    const links = kids(c, 'entryLinks', 'entryLink').filter((l) => !hidden(l) && attr(l, 'type') === 'selectionEntry')
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

  const datasheets: Datasheet[] = [...factionsByEntry].map(([id, facs]) => {
    const d = toDatasheet(entries.get(id)!, [...facs].sort(), ptsId)
    const e = entries.get(id)!
    const ruleIds = kids(e, 'infoLinks', 'infoLink')
      .filter((l) => attr(l, 'type') === 'rule' && !hidden(l))
      .map((l) => attr(l, 'targetId')!)
      .filter((rid) => rules.has(rid))
    const keywords = weaponKeywords(e, linkable)
    return { ...d, ...(ruleIds.length ? { ruleIds: [...new Set(ruleIds)] } : {}), ...(keywords.length ? { weaponKeywords: keywords } : {}) }
  })
  datasheets.sort((a, b) => a.name.localeCompare(b.name))

  const factions: Faction[] = factionCats
    .map((c) => ({ id: c.id, name: c.name.split(' - ').at(-1)!.trim(), fullName: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const ruleList = [...rules.values()].sort((a, b) => Number(a.kind === 'faction') - Number(b.kind === 'faction') || a.name.localeCompare(b.name))
  return { formatVersion: 2, gameId: attr(gst, 'id')!, gameName: attr(gst, 'name')!, source, factions, datasheets, rules: ruleList }
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

/** Weapon keywords ("Assault", "Sustained Hits 1"…) from weapon profiles under a unit, following links to shared weapons. */
function weaponKeywords(e: Node, linkable: Map<string, Node>): string[] {
  const out = new Set<string>()
  const seen = new Set<string>()
  const visit = (n: Node) => {
    walk(n, (tag, el) => {
      if (tag === 'profile' && (attr(el, 'typeName') ?? '').includes('Weapons')) {
        const kw = kids(el, 'characteristics', 'characteristic').find((ch) => attr(ch, 'name') === 'Keywords')
        for (const k of (kw ? textOf(kw) : '').split(',')) {
          const t = k.trim()
          if (t && t !== '-') out.add(t)
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
  return sortUnique([...out])
}
