import { EDITIONS } from '../../domain/catalogue/editions'
import type { Catalogue, CatalogueSource, Datasheet, Faction, Gear, Rule, UpgradeAmount, UpgradeSection, WeaponProfile } from '../../domain/catalogue/types'
import { gearWeapons } from '../../domain/lists/upgrades'
import type { SourceFile } from './bsdata'

/**
 * Converts One Page Rules army books, as Army Forge's public API returns them, into a Catalogue: one catalogue per game
 * system, one faction per army book. MiniTracker ships none of this data.
 * Upgrades are priced per unit, so they are kept as unit-level upgrade sections rather than per-model loadouts.
 * Not converted yet: combined units and spells.
 */

interface OprRule {
  name: string
  label?: string
}
interface OprWeapon {
  name: string
  count?: number
  range?: number
  attacks?: number
  specialRules?: OprRule[]
}
interface OprItem {
  name: string
  count?: number
  content?: (OprWeapon & { type?: string })[]
}
/** What an upgrade option gives: a weapon, an item or a rule. */
type OprGain = OprWeapon & OprItem & OprRule & { type: string }
interface OprAmount {
  type: string
  value?: number
}
interface OprSection {
  uid: string
  label: string
  variant: string
  targets?: string[] | null
  affects?: OprAmount | null
  select?: OprAmount | null
  options: { uid: string; label: string; costs: { unitId: string; cost: number }[]; gains: OprGain[] }[]
}
interface OprUnit {
  id: string
  name: string
  cost: number
  size: number
  quality: number
  defense: number
  rules?: OprRule[]
  items?: OprItem[]
  weapons?: OprWeapon[]
  bases?: { round?: string; square?: string }
  upgrades?: string[]
}
export interface OprBook {
  uid: string
  name: string
  gameSystemSlug: string
  units: OprUnit[]
  specialRules?: { name: string; description: string }[]
  upgradePackages: { uid: string; sections: OprSection[] }[]
}

const editionOfSlug = (slug: string) => EDITIONS.find((e) => e.repo === `army-forge/${slug}`)

/** The army book in a file's text; undefined when the file is something else. */
export function readOprBook(text: string): OprBook | undefined {
  let b: Partial<OprBook>
  try {
    b = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    return undefined
  }
  if (!b || typeof b.uid !== 'string' || typeof b.gameSystemSlug !== 'string' || !Array.isArray(b.units) || !Array.isArray(b.upgradePackages)) return undefined
  return b as OprBook
}

const label = (r: OprRule) => r.label ?? r.name
const unique = (list: string[]) => [...new Set(list)]

const profile = (w: OprWeapon): WeaponProfile => ({
  name: w.name,
  kind: w.range ? 'ranged' : 'melee',
  values: [
    ['Range', w.range ? `${w.range}"` : '-'],
    ['A', String(w.attacks ?? '-')],
    ['Special', (w.specialRules ?? []).map(label).join(', ') || '-'],
  ],
})

const weaponGear = (w: OprWeapon): Gear => ({ name: w.name, count: w.count ?? 1, weapon: profile(w) })

function itemGear(i: OprItem): Gear {
  const content = i.content ?? []
  const contains = content.filter((c) => c.type === 'ArmyBookWeapon').map((c) => ({ weapon: profile(c), count: c.count ?? 1 }))
  const rules = content.filter((c) => c.type === 'ArmyBookRule').map(label)
  return { name: i.name, count: i.count ?? 1, ...(contains.length ? { contains } : {}), ...(rules.length ? { rules } : {}) }
}

function gainGear(g: OprGain): Gear {
  if (g.type === 'ArmyBookWeapon') return weaponGear(g)
  if (g.type === 'ArmyBookItem') return itemGear(g)
  return { name: g.name, count: g.count ?? 1, rules: [label(g)] }
}

const amount = (a: OprAmount | null | undefined): UpgradeAmount | undefined =>
  a ? { type: a.type === 'up to' ? 'upTo' : (a.type as UpgradeAmount['type']), ...(a.value !== undefined ? { value: a.value } : {}) } : undefined

/** The unit's upgrade sections, with only the options priced for it. */
function upgradeSections(book: OprBook, u: OprUnit): UpgradeSection[] {
  const packages = new Map(book.upgradePackages.map((p) => [p.uid, p]))
  return (u.upgrades ?? []).flatMap((id) =>
    (packages.get(id)?.sections ?? []).flatMap((s) => {
      const options = s.options.flatMap((o) => {
        const cost = o.costs.find((c) => c.unitId === u.id)
        return cost ? [{ id: o.uid, label: o.label, points: cost.cost, gains: o.gains.map(gainGear) }] : []
      })
      if (!options.length) return []
      const affects = amount(s.affects)
      const select = amount(s.select)
      return [{ id: s.uid, label: s.label, variant: s.variant as UpgradeSection['variant'], targets: s.targets ?? [], ...(affects ? { affects } : {}), ...(select ? { select } : {}), options }]
    }),
  )
}

function datasheet(book: OprBook, u: OprUnit): Datasheet {
  const rules = (u.rules ?? []).map(label)
  const hero = (u.rules ?? []).some((r) => r.name === 'Hero')
  const gear = [...(u.weapons ?? []).map(weaponGear), ...(u.items ?? []).map(itemGear)]
  const upgrades = upgradeSections(book, u)
  const stats: [string, string][] = [['Quality', `${u.quality}+`], ['Defense', `${u.defense}+`]]
  const base = u.bases?.round ?? u.bases?.square
  if (base) stats.push(['Base', `${base} mm`])
  return {
    // The same unit id can appear in several books.
    id: `${book.uid}/${u.id}`,
    name: u.name,
    factionIds: [book.uid],
    ...(hero ? { role: 'Hero' } : {}),
    keywords: hero ? ['Hero'] : [],
    factionKeywords: [book.name],
    minModels: u.size,
    maxModels: u.size,
    points: [{ fromModels: u.size, points: u.cost }],
    wargear: unique([...gear, ...upgrades.flatMap((s) => s.options.flatMap((o) => o.gains))].map((g) => g.name)),
    abilities: rules,
    legends: false,
    stats: [{ name: u.name, values: stats }],
    weapons: gearWeapons(gear),
    gear,
    upgrades,
  }
}

function buildCatalogue(books: OprBook[], source: CatalogueSource): Catalogue {
  const slug = books[0].gameSystemSlug
  const edition = editionOfSlug(slug)
  if (!edition) throw new Error(`Unknown One Page Rules game: ${slug}`)
  if (books.some((b) => b.gameSystemSlug !== slug)) throw new Error('These army books are for different games')
  const factions: Faction[] = books.map((b) => ({ id: b.uid, name: b.name, fullName: b.name }))
  const rules: Rule[] = books.flatMap((b) =>
    (b.specialRules ?? []).map((r, i) => ({ id: `${b.uid}/rule-${i}`, name: r.name, text: r.description, kind: 'faction' as const, factionId: b.uid })),
  )
  return {
    formatVersion: 7,
    gameId: `opr-${edition.game}`,
    gameName: NAMES[slug] ?? slug,
    source,
    // No muster rules in the data; this turns the list checks on (points and upgrades).
    muster: { battleSizes: [], keywordMinimums: [] },
    factions: factions.sort((a, b) => a.name.localeCompare(b.name)),
    datasheets: books.flatMap((b) => b.units.map((u) => datasheet(b, u))),
    rules,
  }
}

const NAMES: Record<string, string> = {
  'grimdark-future': 'Grimdark Future',
  'grimdark-future-firefight': 'Grimdark Future: Firefight',
  'age-of-fantasy': 'Age of Fantasy',
  'age-of-fantasy-skirmish': 'Age of Fantasy: Skirmish',
  'age-of-fantasy-regiments': 'Age of Fantasy: Regiments',
}

/** All army books of one game, as downloaded. */
export function parseOpr(files: SourceFile[], source: CatalogueSource): Catalogue {
  const books = files.map((f) => {
    const book = readOprBook(f.text)
    if (!book) throw new Error(`${f.name} is not an Army Forge army book`)
    return book
  })
  if (!books.length) throw new Error('No army books found')
  return buildCatalogue(books, source)
}

/** Adds the books of `next` to `old`, replacing the books both have. */
function merge(old: Catalogue, next: Catalogue): Catalogue {
  const replaced = new Set(next.factions.map((f) => f.id))
  return {
    ...next,
    factions: [...old.factions.filter((f) => !replaced.has(f.id)), ...next.factions].sort((a, b) => a.name.localeCompare(b.name)),
    datasheets: [...old.datasheets.filter((d) => !d.factionIds.some((id) => replaced.has(id))), ...next.datasheets],
    rules: [...(old.rules ?? []).filter((r) => !replaced.has(r.factionId ?? '')), ...(next.rules ?? [])],
  }
}

/** Picks the army books out of imported files and adds them to their games' catalogues; other files are returned. */
export function importOprBooks(files: SourceFile[], installed: Catalogue[], now: string): { catalogues: Catalogue[]; rest: SourceFile[] } {
  const rest: SourceFile[] = []
  const byGame = new Map<string, OprBook[]>()
  for (const f of files) {
    const book = readOprBook(f.text)
    if (!book) rest.push(f)
    else byGame.set(book.gameSystemSlug, [...(byGame.get(book.gameSystemSlug) ?? []), book])
  }
  const catalogues = [...byGame].map(([slug, books]) => {
    // The last file wins when the same book is picked twice.
    const latest = [...new Map(books.map((b) => [b.uid, b])).values()]
    const next = buildCatalogue(latest, { repo: `army-forge/${slug}`, commit: 'local', fetchedAt: now })
    const old = installed.find((c) => c.gameId === next.gameId)
    return old ? merge(old, next) : next
  })
  return { catalogues, rest }
}
