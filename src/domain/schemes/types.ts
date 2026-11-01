import type { Link } from '../collection/types'

/** official = the faction's studio colours; community = a variant found online; personal = yours. */
export type SchemeOrigin = 'official' | 'community' | 'personal'

export interface StepPaint {
  paintId: string
  /** Mix ratio parts, e.g. 2 for "2 parts". Absent = single paint / 1 part. */
  parts?: number
}

export interface SchemeStep {
  id: string
  /** basecoat, shade, layer, edge highlight… (free text, suggestions in TECHNIQUES) */
  technique: string
  paints: StepPaint[]
  /** e.g. "2:1 with water", "glaze medium" */
  thinning?: string
  /** e.g. "size 1 brush", "drybrush" */
  tool?: string
  note: string
}

export interface SchemeSection {
  id: string
  /** Armour, cloth, skin, metal, base… */
  area: string
  steps: SchemeStep[]
}

export interface PaintScheme {
  id: string
  name: string
  description: string
  origin: SchemeOrigin
  /** The scheme this one is a variant of. */
  basedOn?: string
  factionName?: string
  /** Unit types this scheme is made for (e.g. "Vespid", "Stealth"). Empty = army-wide. */
  appliesTo?: string[]
  /** Stage id from the scheme pipeline (idea, testing, final, archived). */
  stage: string
  tags: string[]
  /** 1–5 */
  difficulty?: number
  minutesPerModel?: number
  /** Where a non-personal scheme comes from. */
  source?: { title?: string; url?: string; author?: string }
  /** Common mistakes / tips. */
  tips: string
  tutorials: Link[]
  coverPhotoId?: string
  sections: SchemeSection[]
  createdAt: string
  updatedAt: string
}
