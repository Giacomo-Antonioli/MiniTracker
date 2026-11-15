/**
 * Units the catalogue may not list because the data source treats them as wargear or upgrades,
 * although they are sold and painted as separate models. Offered as custom units (no datasheet link).
 */
export interface ExtraUnit {
  name: string
  faction: string
  models: number
}

const tau = (name: string): ExtraUnit => ({ name, faction: "T'au Empire", models: 1 })

export const EXTRA_UNITS: ExtraUnit[] = [
  tau('Shield Drone'),
  tau('Missile Drone'),
  tau('Gun Drone'),
  tau('Marker Drone'),
  tau('Sniper Drone'),
  tau('Guardian Drone'),
]

const norm = (s: string) => s.toLowerCase().replace(/['’]/g, '').trim()

/** Extras matching the typed text and faction, skipping names the catalogue already has. */
export function matchExtraUnits(query: string, faction: string, catalogueNames: string[], extras: ExtraUnit[] = EXTRA_UNITS): ExtraUnit[] {
  const q = norm(query)
  const f = norm(faction)
  const have = new Set(catalogueNames.map(norm))
  return extras.filter((e) => !have.has(norm(e.name)) && norm(e.name).includes(q) && (!f || norm(e.faction).includes(f) || f.includes(norm(e.faction))))
}
