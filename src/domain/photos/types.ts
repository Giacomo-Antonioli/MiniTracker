/** What a photo belongs to. Scheme owners arrive with #27. */
export type PhotoOwner = { kind: 'unit'; unitId: string } | { kind: 'event'; unitId: string; eventId: string } | { kind: 'scheme'; schemeId: string; stepId?: string } | { kind: 'game'; gameId: string }

/** Photo metadata (small, listed often). The image data lives in PhotoFiles. */
export interface Photo {
  id: string
  owner: PhotoOwner
  /** Indexed copy of the unit id for unit and event photos. */
  unitId?: string
  /** Indexed copy of the scheme id for scheme and step photos. */
  schemeId?: string
  /** Indexed copy of the game id for game photos (#164). */
  gameId?: string
  /** Meaningful, permanent file name, e.g. ultramarines_intercessor-squad_mt-3f9a2c1b_painted_20261102_01.jpg */
  fileName: string
  caption: string
  takenAt: string
  createdAt: string
  width: number
  height: number
  originalType: string
  originalBytes: number
  displayBytes: number
  /** False once the original was dropped to save space. */
  hasOriginal: boolean
}

/** The image data of one photo. */
export interface PhotoFiles {
  id: string
  /** Compressed copy (~1600px) shown in the app. */
  display: Blob
  /** Untouched original, as added. */
  original?: Blob
}
