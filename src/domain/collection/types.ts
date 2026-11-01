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

/** Overall state of a unit, separate from its painting stage. */
export type Lifecycle = 'active' | 'on-hold' | 'sold' | 'traded' | 'gifted' | 'lost'

/** Generic pointer to an outside resource; `kind` is open so new integrations need no schema change. */
export interface ExternalRef {
  kind: string
  uri: string
  label?: string
}

export interface Stage {
  id: StageId
  name: string
}

/** One global, user-editable list of stages, in order. */
export interface Pipeline {
  stages: Stage[]
}

/** One step in a unit's painting history. */
export interface StatusEvent {
  id: string
  unitId: string
  groupId: string
  from: StageId
  to: StageId
  count: number
  /** ISO date or date-time; defaults to now, user-editable. */
  date: string
  direction: 'forward' | 'backward'
  photoId?: string
  note: string
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
  lifecycle: Lifecycle
  favourite: boolean
  nextUp: boolean
  /** Links to things outside the app, e.g. a digital twin or a 3D model file. */
  externalRefs: ExternalRef[]
  createdAt: string
  updatedAt: string
}

/** Clock and id source, injected so domain code stays deterministic in tests. */
export interface Ctx {
  now: string
  newId: () => string
}
