import type { BoxContent } from '../barcodes/barcodes'
import type { Catalogue, Datasheet } from '../catalogue/types'
import type { NewUnit } from '../collection/ownedUnit'
import type { StageId } from '../collection/types'

/**
 * Age of Sigmar Spearhead armies (#99): each is one box with fixed contents. Built from Games Workshop's free
 * Spearhead PDFs by tools/spearhead/build.mts into src/data/spearhead/boxes.json.
 */
export interface SpearheadEntry {
  name: string
  models: number
}
export interface SpearheadBox {
  id: string
  name: string
  /** Age of Sigmar faction, as BSData names it. */
  faction: string
  general: SpearheadEntry
  units: SpearheadEntry[]
  /** The Warhammer Community PDF it was read from. */
  source: string
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const variant = (d: Datasheet) => d.legends || /\(scourge of/i.test(d.name)

/**
 * Catalogue units a Spearhead entry may stand for, best first. Exact name first; otherwise names that start with
 * the other ("Kurnoth Hunters" → every "Kurnoth Hunters with …" build, "Rock-hurler" → "Rock-hurlers"), preferring
 * the box's faction and leaving out Legends and Scourge variants. Several builds stay as choices for the user.
 */
export function candidates(name: string, catalogue: Catalogue, faction?: string): Datasheet[] {
  const factionIds = new Set(catalogue.factions.filter((f) => faction && norm(f.name) === norm(faction)).map((f) => f.id))
  const inFaction = (d: Datasheet) => d.factionIds.some((id) => factionIds.has(id))
  const rank = (ds: Datasheet[]) => [...ds].sort((a, b) => Number(variant(a)) - Number(variant(b)) || Number(inFaction(b)) - Number(inFaction(a)) || a.name.length - b.name.length || a.name.localeCompare(b.name))
  const n = norm(name)
  for (const t of [n, n.replace(/^ogor/, '')]) {
    const exact = catalogue.datasheets.filter((d) => norm(d.name) === t)
    if (exact.length) return rank(exact)
    const near = catalogue.datasheets.filter((d) => !variant(d) && (norm(d.name).startsWith(t) || t.startsWith(norm(d.name))) && Math.min(t.length, norm(d.name).length) >= 6)
    if (near.length) return rank(near)
  }
  return []
}

export const matchDatasheet = (name: string, catalogue: Catalogue, faction?: string): Datasheet | undefined => candidates(name, catalogue, faction)[0]

/** What is in the box, general first; entries of the same unit add up ("5 Witch Aelves" twice → 10). */
export function boxContents(box: SpearheadBox, catalogue?: Catalogue | null): (BoxContent & { entry: string })[] {
  const out = new Map<string, BoxContent & { entry: string }>()
  for (const e of [box.general, ...box.units]) {
    const d = catalogue ? matchDatasheet(e.name, catalogue, box.faction) : undefined
    const key = d?.id ?? norm(e.name)
    const prev = out.get(key)
    if (prev) prev.models += e.models
    else out.set(key, { entry: e.name, ...(d ? { datasheetId: d.id } : {}), name: d?.name ?? e.name, models: e.models })
  }
  return [...out.values()]
}

/** Backlog units for a box: one per content line, at the given stage, linked to the catalogue where it matched. */
export function unitsForBox(box: SpearheadBox, catalogue: Catalogue | null | undefined, status: StageId, picks: Record<string, string> = {}): NewUnit[] {
  return boxContents(box, catalogue).map((c) => {
    // The user may pick another build ("Kurnoth Hunters with Kurnoth Greatbows") for an entry.
    const pick = picks[c.entry]
    if (pick !== undefined) c = { ...c, datasheetId: pick || undefined, name: catalogue?.datasheets.find((x) => x.id === pick)?.name ?? c.entry }
    const d = c.datasheetId ? catalogue?.datasheets.find((x) => x.id === c.datasheetId) : undefined
    const factionId = d?.factionIds.find((id) => norm(catalogue!.factions.find((f) => f.id === id)?.name ?? '') === norm(box.faction)) ?? d?.factionIds[0]
    return {
      customName: c.name,
      ...(d ? { datasheetId: d.id } : {}),
      ...(factionId ? { factionId } : {}),
      factionName: box.faction,
      tags: ['Spearhead', box.name],
      groups: [{ count: c.models, status }],
    }
  })
}
