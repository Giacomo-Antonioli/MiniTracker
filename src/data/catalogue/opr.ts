import { EDITIONS } from '../../domain/catalogue/editions'
import type { Catalogue, CatalogueSource, Datasheet, Faction, Rule, WeaponProfile } from '../../domain/catalogue/types'
import type { SourceFile } from './bsdata'

/**
 * Converts One Page Rules army books, as Army Forge's public API returns them, into a Catalogue: one catalogue per game
 * system, one faction per army book. MiniTracker ships none of this data.
 * Not converted yet: unit upgrades (priced per unit, unlike MiniTracker's per-model loadouts), combined units, spells.
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
interface OprUnit {
  id: string
  name: string
  cost: number
  size: number
  quality: number
  defense: number
  rules?: OprRule[]
  items?: { name: string }[]
  weapons?: OprWeapon[]
  bases?: { round?: string; square?: string }
}
export interface OprBook {
  uid: string
  name: string
  gameSystemSlug: string
  units: OprUnit[]
  specialRules?: { name: string; description: string }[]
  upgradePackages: unknown[]
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

function datasheet(book: OprBook, u: OprUnit): Datasheet {
  const rules = (u.rules ?? []).map(label)
  const hero = (u.rules ?? []).some((r) => r.name === 'Hero')
  const weapons: WeaponProfile[] = (u.weapons ?? []).map((w) => ({
    name: w.name,
    kind: w.range ? 'ranged' : 'melee',
    values: [
      ['Count', String(w.count ?? 1)],
      ['Range', w.range ? `${w.range}"` : '-'],
      ['A', String(w.attacks ?? '-')],
      ['Special', (w.specialRules ?? []).map(label).join(', ') || '-'],
    ],
  }))
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
    wargear: unique([...(u.weapons ?? []).map((w) => w.name), ...(u.items ?? []).map((i) => i.name)]),
    abilities: rules,
    legends: false,
    stats: [{ name: u.name, values: stats }],
    weapons,
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
