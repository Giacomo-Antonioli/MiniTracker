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

/**
 * A BSData condition, kept so it can be checked against a list later.
 * Leaves count what the list has: a battle size, detachment, unit or enhancement by id, or units/detachments with a keyword.
 */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { op: ConditionOp; value: number; id?: string; keyword?: string }

export type ConditionOp = 'atLeast' | 'atMost' | 'equalTo' | 'notEqualTo' | 'lessThan' | 'greaterThan' | 'instanceOf' | 'notInstanceOf'

export interface LimitModifier {
  type: 'set' | 'increment' | 'decrement'
  value: number
  /** Missing = always applies. */
  when?: Condition
}

/** A maximum that modifiers can change depending on the list (-1 = no limit). */
export interface DataLimit {
  max: number
  modifiers: LimitModifier[]
}

/** Army-building rules read from the data. */
export interface Muster {
  battleSizes: BattleSize[]
  keywordMinimums: KeywordMinimum[]
  /** Detachment points an army may spend (11th edition). */
  detachmentPoints?: DataLimit
  /** Enhancements an army may take. */
  enhancements?: DataLimit
  /** The main force (Army Roster): conditions "is this an Army Roster" count it as present. */
  forceId?: string
}

export interface Detachment {
  id: string
  name: string
  factionIds: string[]
  /** 11th edition cost against the army's detachment points; 0 in 10th. */
  detachmentPoints: number
  /** Keywords such as "3DP Detachment" that conditions can test. */
  keywords: string[]
}

export interface Enhancement {
  id: string
  name: string
  points: number
  detachmentId: string
}

/** How many detachments a faction's army takes. */
export interface DetachmentCount {
  min: number
  max: DataLimit
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
  /** 2 = includes rules and ability texts; 3 = muster rules and army limits; 4 = detachments and enhancements. Older catalogues have none. */
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
  /** Missing in catalogues downloaded before format 4. */
  detachments?: Detachment[]
  enhancements?: Enhancement[]
  /** Faction id → detachment count rule. */
  detachmentCounts?: Record<string, DetachmentCount>
}
