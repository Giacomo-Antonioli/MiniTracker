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
  /** Ability name → its text (catalogue format 2). */
  abilityTexts?: Record<string, string>
  /** Rules the unit has (core like Deep Strike, faction like Oath of Moment) — ids in Catalogue.rules. */
  ruleIds?: string[]
  /** Weapon abilities as written on its weapons, e.g. "Assault", "Sustained Hits 1". */
  weaponKeywords?: string[]
}

export interface Rule {
  id: string
  name: string
  /** Rule text as published in the data (may contain **bold** markers). */
  text: string
  kind: 'core' | 'faction'
  /** For faction rules: the catalogue (faction) that defines it. */
  factionId?: string
  aliases?: string[]
}

export interface CatalogueSource {
  repo: string
  /** Git commit the data was read from. */
  commit: string
  fetchedAt: string
}

export interface Catalogue {
  /** 2 = includes rules and ability texts. Older catalogues have none. */
  formatVersion?: number
  gameId: string
  gameName: string
  source: CatalogueSource
  factions: Faction[]
  datasheets: Datasheet[]
  /** Missing in catalogues downloaded before format 2. */
  rules?: Rule[]
}
