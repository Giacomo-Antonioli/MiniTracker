import { isGone, WISHLISTED } from '../collection/pipeline'
import type { OwnedUnit, Pipeline, StageId } from '../collection/types'

/**
 * Read-only share link for the collection and painting progress (#97): a small snapshot, compressed into the
 * link, so anyone can look without an account or a server. Nothing is saved on the viewer's device.
 */
export const SHOWCASE_FORMAT = 'minitracker-showcase'
export const SHOWCASE_HASH = '#view='

export interface Showcase {
  format: typeof SHOWCASE_FORMAT
  v: 1
  /** Whose collection, as typed by the sender. */
  owner: string
  at: string
  /** Stage names in order; models at `painted` or later count as painted. */
  stages: string[]
  painted: number
  /** Units: [name, faction, models per stage]. Short arrays keep the link short. */
  units: [string, string, number[]][]
}

export interface ShowcaseOptions {
  owner: string
  /** Only these factions; all when empty. */
  factions?: string[]
  wishlist?: boolean
}

export const factionOf = (u: OwnedUnit) => u.factionName?.trim() || 'No faction'

export function buildShowcase(units: OwnedUnit[], p: Pipeline, o: ShowcaseOptions, now: string, painted: StageId = 'painted'): Showcase {
  const stages = p.stages.filter((s) => o.wishlist || s.id !== WISHLISTED)
  const at = stages.findIndex((s) => s.id === painted)
  const keep = new Set(o.factions ?? [])
  const rows: Showcase['units'] = []
  for (const u of units) {
    if (isGone(u.lifecycle) || (keep.size && !keep.has(factionOf(u)))) continue
    const counts = stages.map((s) => u.groups.filter((g) => g.status === s.id).reduce((n, g) => n + g.count, 0))
    if (counts.some((c) => c > 0)) rows.push([u.customName, factionOf(u), counts])
  }
  rows.sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))
  return { format: SHOWCASE_FORMAT, v: 1, owner: o.owner.trim(), at: now, stages: stages.map((s) => s.name), painted: at < 0 ? Math.max(0, stages.length - 1) : at, units: rows }
}

export function parseShowcase(text: string): Showcase {
  let raw: Partial<Showcase>
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('This share link is broken or incomplete')
  }
  if (raw?.format !== SHOWCASE_FORMAT || !Array.isArray(raw.units) || !Array.isArray(raw.stages)) throw new Error('This is not a MiniTracker collection link')
  if ((raw.v ?? 0) > 1) throw new Error('This link was made by a newer MiniTracker; update the app to open it')
  const n = raw.stages.length
  const units = raw.units.filter((u): u is [string, string, number[]] => Array.isArray(u) && typeof u[0] === 'string' && typeof u[1] === 'string' && Array.isArray(u[2]) && u[2].length === n && u[2].every((c) => Number.isInteger(c) && c >= 0))
  return { format: SHOWCASE_FORMAT, v: 1, owner: String(raw.owner ?? ''), at: String(raw.at ?? ''), stages: raw.stages.map(String), painted: Math.min(n, Math.max(0, Number(raw.painted) || 0)), units }
}

export interface Progress {
  models: number
  painted: number
  /** Models per stage. */
  byStage: number[]
}

function progress(rows: Showcase['units'], s: Showcase): Progress {
  const byStage = s.stages.map((_, i) => rows.reduce((n, u) => n + u[2][i], 0))
  const models = byStage.reduce((a, b) => a + b, 0)
  return { models, painted: byStage.slice(s.painted).reduce((a, b) => a + b, 0), byStage }
}

/** Totals for the whole snapshot and per faction (largest first). */
export function showcaseSummary(s: Showcase) {
  const factions = [...new Set(s.units.map((u) => u[1]))]
  return {
    total: progress(s.units, s),
    factions: factions.map((f) => ({ faction: f, ...progress(s.units.filter((u) => u[1] === f), s) })).sort((a, b) => b.models - a.models || a.faction.localeCompare(b.faction)),
  }
}

export const percent = (p: Progress) => (p.models ? Math.round((p.painted / p.models) * 100) : 0)
