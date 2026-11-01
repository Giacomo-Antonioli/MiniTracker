import type { Catalogue, Datasheet } from './types'

export interface SearchOptions {
  factionId?: string
  includeLegends?: boolean
  limit?: number
}

/** Datasheets whose name (or keywords) match every word of the query, best matches first. */
export function searchDatasheets(cat: Catalogue, query: string, opts: SearchOptions = {}): Datasheet[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const q = words.join(' ')
  const scored: { d: Datasheet; score: number }[] = []
  for (const d of cat.datasheets) {
    if (opts.factionId && !d.factionIds.includes(opts.factionId)) continue
    if (d.legends && !opts.includeLegends) continue
    const name = d.name.toLowerCase()
    const hay = [name, ...d.keywords.map((k) => k.toLowerCase())].join(' ')
    if (!words.every((w) => hay.includes(w))) continue
    const score = !q ? 0 : name.startsWith(q) ? 0 : name.split(/\s+/).some((w) => w.startsWith(words[0])) ? 1 : 2
    scored.push({ d, score })
  }
  scored.sort((a, b) => a.score - b.score || a.d.name.localeCompare(b.d.name))
  return scored.slice(0, opts.limit ?? 50).map((s) => s.d)
}

/** Faction name to show for a datasheet, preferring `preferredId` when the unit belongs to it. */
export function factionLabel(cat: Catalogue, d: Datasheet, preferredId?: string): string {
  const id = preferredId && d.factionIds.includes(preferredId) ? preferredId : d.factionIds[0]
  return cat.factions.find((f) => f.id === id)?.name ?? ''
}
