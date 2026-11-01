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
  /** How many of this unit an army may include (e.g. 3, Epic Heroes 1); some battle sizes change it. */
  armyLimit?: ArmyLimit
}

export interface ArmyLimit {
  max: number
  /** Battle size id → max, only where it differs from `max`. */
  byBattleSize?: Record<string, number>
}

export interface BattleSize {
  id: string
  name: string
  pointsLimit: number
}

/** "At least N units with this keyword", e.g. 1 Character. */
export interface KeywordMinimum {
  keyword: string
  min: number
  /** Factions (catalogue ids) the rule does not apply to. */
  exemptFactionIds: string[]
}

/** Army-building rules read from the data. */
export interface Muster {
  battleSizes: BattleSize[]
  keywordMinimums: KeywordMinimum[]
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
  /** 2 = includes rules and ability texts; 3 = muster rules and army limits. Older catalogues have none. */
  formatVersion?: number
  gameId: string
  gameName: string
  source: CatalogueSource
  factions: Faction[]
  datasheets: Datasheet[]
  /** Missing in catalogues downloaded before format 2. */
  rules?: Rule[]
  /** Missing in catalogues downloaded before format 3. */
  muster?: Muster
}
