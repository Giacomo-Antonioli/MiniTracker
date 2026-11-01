import type { Catalogue } from '../catalogue/types'
import { totalModels } from '../collection/ownedUnit'
import { isGone } from '../collection/pipeline'
import type { Ctx, OwnedUnit } from '../collection/types'
import type { PaintStock } from '../paints/types'
import { paintIdsOf } from '../schemes/scheme'
import type { PaintScheme } from '../schemes/types'
import { addEntry } from './list'
import type { ListOwnership } from './ownership'
import { legalUnits } from './rules'
import { HAVE_PAINT } from './schemes'
import type { ArmyList } from './types'


export interface CollectionPlan {
  /** Units used by the list with models still to paint, most first. */
  toPaint: { unit: OwnedUnit; models: number }[]
  /** Paints in the schemes of those units that you don't have (no pot, or only wishlist / ordered / empty). */
  missingPaints: { paintId: string; schemes: string[] }[]
}

export function collectionPlan(
  own: ListOwnership,
  units: OwnedUnit[],
  schemes: PaintScheme[],
  stock: Map<string, PaintStock>,
  schemeDefaults: Record<string, string> = {},
): CollectionPlan {
  const byId = new Map(units.map((u) => [u.id, u]))
  const unpainted = new Map<string, number>()
  // Painted models were used first per entry, so an entry's unpainted models sit in its last sources.
  for (const o of own.byEntry.values()) {
    let paintedLeft = o.painted
    for (const f of o.from) {
      const p = Math.min(paintedLeft, f.models)
      paintedLeft -= p
      if (f.models - p > 0) unpainted.set(f.unitId, (unpainted.get(f.unitId) ?? 0) + f.models - p)
    }
  }
  const toPaint = [...unpainted]
    .map(([id, models]) => ({ unit: byId.get(id)!, models }))
    .filter((x) => x.unit)
    .sort((a, b) => b.models - a.models || a.unit.customName.localeCompare(b.unit.customName))

  const usedUnits = new Set([...own.byEntry.values()].flatMap((o) => o.from.map((f) => f.unitId)))
  const schemeById = new Map(schemes.map((s) => [s.id, s]))
  const missing = new Map<string, Set<string>>()
  for (const id of usedUnits) {
    const u = byId.get(id)
    const s = u && schemeById.get(u.schemeId ?? (u.factionName ? schemeDefaults[u.factionName] : '') ?? '')
    if (!s) continue
    for (const p of paintIdsOf(s)) {
      if (HAVE_PAINT.has(stock.get(p)?.stage ?? '')) continue
      missing.set(p, (missing.get(p) ?? new Set()).add(s.name))
    }
  }
  return {
    toPaint,
    missingPaints: [...missing].map(([paintId, names]) => ({ paintId, schemes: [...names].sort() })).sort((a, b) => a.paintId.localeCompare(b.paintId)),
  }
}

/**
 * Adds every unit you own of the list's faction (still in the collection, with a catalogue entry), each linked to its
 * collection unit. Model counts are kept within the datasheet's allowed sizes. Units already linked are skipped.
 */
export function addFromCollection(l: ArmyList, cat: Catalogue, units: OwnedUnit[], ctx: Ctx, opts: { legends?: boolean } = {}): ArmyList {
  if (!l.factionId) throw new Error('Choose a faction first')
  const legal = new Map(legalUnits(cat, l.factionId, opts).map((d) => [d.id, d]))
  const linked = new Set(l.entries.map((e) => e.ownedUnitId))
  let out = l
  for (const u of units) {
    const d = u.datasheetId ? legal.get(u.datasheetId) : undefined
    if (!d || isGone(u.lifecycle) || linked.has(u.id)) continue
    const models = Math.min(d.maxModels, Math.max(d.minModels, totalModels(u)))
    out = addEntry(out, { datasheetId: d.id, models, ownedUnitId: u.id }, ctx)
  }
  return out
}
