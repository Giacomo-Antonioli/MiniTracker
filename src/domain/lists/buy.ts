import type { Datasheet } from '../catalogue/types'
import type { ListOwnership } from './ownership'
import type { ListPoints } from './points'
import type { ArmyList } from './types'

export interface BuyRow {
  datasheetId: string
  name: string
  /** List entries of this unit that are not fully owned. */
  units: number
  missingModels: number
  /** Points of those entries in the list. */
  points: number
}

export interface BuyList {
  rows: BuyRow[]
  missingModels: number
  points: number
}

/** What to buy to field this list: everything not owned, by unit, biggest gap first. */
export function buyList(l: ArmyList, sheets: Map<string, Datasheet>, own: ListOwnership, pts: ListPoints): BuyList {
  const rows = new Map<string, BuyRow>()
  for (const e of l.entries) {
    const o = own.byEntry.get(e.id)
    if (!o || o.state === 'owned') continue
    const r = rows.get(e.datasheetId) ?? { datasheetId: e.datasheetId, name: sheets.get(e.datasheetId)?.name ?? 'Unknown unit', units: 0, missingModels: 0, points: 0 }
    r.units += 1
    r.missingModels += o.need - o.have
    r.points += pts.byEntry.get(e.id) ?? 0
    rows.set(e.datasheetId, r)
  }
  const list = [...rows.values()].sort((a, b) => b.missingModels - a.missingModels || a.name.localeCompare(b.name))
  return { rows: list, missingModels: list.reduce((n, r) => n + r.missingModels, 0), points: list.reduce((n, r) => n + r.points, 0) }
}

/** A paint the list's units need for their schemes and you don't have. */
export interface BuyPaint {
  name: string
  schemes: string[]
}

/** Plain text, e.g. for a shopping note or a message. */
export function buyListText(listName: string, b: BuyList, paints: BuyPaint[] = []): string {
  if (!b.rows.length && !paints.length) return `${listName}: nothing to buy`
  const out = [`Buy list – ${listName}`]
  if (b.rows.length) {
    out.push(...b.rows.map((r) => `- ${r.name}: ${r.missingModels} model${r.missingModels === 1 ? '' : 's'}${r.units > 1 ? ` (${r.units} units)` : ''}`))
    out.push(`Total: ${b.missingModels} models`)
  }
  if (paints.length) out.push('', `Paints (${paints.length}):`, ...paints.map((x) => `- ${x.name} (${x.schemes.join(', ')})`))
  return out.join('\n')
}
