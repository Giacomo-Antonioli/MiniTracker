/** Catalogue edition a list was built for (matches EDITIONS keys in data/catalogue/fetch.ts). */
export type EditionKey = '11e' | '10e'

export type ListStatus = 'planned' | 'playable'

/** One unit in an army list. */
export interface ListEntry {
  id: string
  datasheetId: string
  /** Number of models; sets the points step. */
  models: number
  /** Chosen wargear options. */
  wargear: string[]
  /** Enhancement given to this unit (#54). */
  enhancementId?: string
  warlord?: boolean
  /** Optional link to one unit of the collection; otherwise matched by datasheet. */
  ownedUnitId?: string
  /** Colour scheme for this unit in this list (overrides the army scheme). */
  schemeId?: string
  /** Id of the entry this leader is attached to. */
  attachedTo?: string
}

export interface ArmyList {
  id: string
  name: string
  edition: EditionKey
  /** Unset until chosen, or until the first unit is added (see addUnit). */
  factionId?: string
  /** Battle size id: a BSData battle size entry, or COMBAT_PATROL.id. */
  battleSize: string
  /** Set from the battle size, editable by the user. */
  pointsLimit: number
  /** Chosen detachments (10th edition: one; 11th: several, within the detachment points). */
  detachmentIds?: string[]
  /** Colour scheme for the whole army. */
  schemeId?: string
  status: ListStatus
  entries: ListEntry[]
  notes: string
  createdAt: string
  updatedAt: string
}
