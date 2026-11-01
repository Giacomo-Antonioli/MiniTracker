import type { Datasheet } from '../catalogue/types'
import type { OwnedUnit } from '../collection/types'
import type { PaintScheme, SchemeOrigin } from './types'

const low = (s: string) => s.toLowerCase().replace(/['’]/g, '')

/**
 * Does a scheme belong on this unit?
 * - faction: the scheme's faction must be the unit's (schemes without faction fit any unit)
 * - unit type: schemes made for a unit type (appliesTo, e.g. "Vespid") only fit units whose name or
 *   datasheet name/keywords mention it; army-wide schemes fit every unit of the faction.
 */
export function schemeFitsUnit(s: PaintScheme, unit: OwnedUnit, datasheet?: Datasheet): boolean {
  if (s.factionName) {
    const factions = [unit.factionName, ...(datasheet?.factionKeywords ?? [])].filter((f): f is string => !!f).map(low)
    if (!factions.includes(low(s.factionName))) return false
  }
  if (!s.appliesTo?.length) return true
  const hay = low([unit.customName, datasheet?.name ?? '', ...(datasheet?.keywords ?? [])].join(' | '))
  return s.appliesTo.some((t) => hay.includes(low(t)))
}

const ORDER: SchemeOrigin[] = ['official', 'community', 'personal']

/** Schemes that fit a unit, grouped by origin; the one already linked is always included. */
export function schemesForUnit(schemes: PaintScheme[], unit: OwnedUnit, datasheet?: Datasheet): { origin: SchemeOrigin; schemes: PaintScheme[] }[] {
  const fit = schemes.filter((s) => s.id === unit.schemeId || schemeFitsUnit(s, unit, datasheet))
  return ORDER.map((origin) => ({ origin, schemes: fit.filter((s) => s.origin === origin).sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.schemes.length)
}
