/** Painting stage id, e.g. 'built' or 'painted'. The pipeline itself is defined in issue #2. */
export type StageId = string

/** A magnetised position on a model that can take one of several options. */
export interface MagnetSlot {
  slot: string
  optionIds: string[]
}

/** Models of one unit that share stage, loadout and magnets. */
export interface ModelGroup {
  id: string
  count: number
  status: StageId
  loadout: string[]
  magnetised: MagnetSlot[]
}

export interface Link {
  url: string
  title: string
  kind: 'build' | 'paint' | 'lore' | 'other'
}

export interface OwnedUnit {
  id: string
  /** Own name, kept even if the catalogue entry changes or disappears. */
  customName: string
  datasheetId?: string
  factionId?: string
  kitIds: string[]
  groups: ModelGroup[]
  schemeId?: string
  tutorials: Link[]
  notes: string
  photoIds: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

/** Clock and id source, injected so domain code stays deterministic in tests. */
export interface Ctx {
  now: string
  newId: () => string
}
