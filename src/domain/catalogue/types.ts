/** Read-only game data, converted from BSData on the user's device. */

export interface Faction {
  id: string
  name: string
  /** Full catalogue name, e.g. "Imperium - Adeptus Astartes - Ultramarines". */
  fullName: string
}

export interface PointsStep {
  /** This price applies from this many models upwards (until the next step). */
  fromModels: number
  points: number
}

export interface Datasheet {
  id: string
  name: string
  factionIds: string[]
  /** Battlefield role, e.g. "Battleline", "Character", "Vehicle". */
  role?: string
  keywords: string[]
  factionKeywords: string[]
  minModels: number
  maxModels: number
  points: PointsStep[]
  wargear: string[]
  abilities: string[]
  legends: boolean
}

export interface CatalogueSource {
  repo: string
  /** Git commit the data was read from. */
  commit: string
  fetchedAt: string
}

export interface Catalogue {
  gameId: string
  gameName: string
  source: CatalogueSource
  factions: Faction[]
  datasheets: Datasheet[]
}
