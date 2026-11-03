import type { PaintScheme, SchemeSection } from '../schemes/types'
import { techniqueFor, type Technique } from './techniques'

/**
 * "Before you start" for a scheme: the areas in a sensible painting order, the techniques used,
 * the number of paints and a difficulty. Worked out from the recipe, so every scheme gets one.
 */

// Painting order: preparation, inside to outside, big areas before small ones, base last.
const STAGES = ['Preparation', 'Skin and under-layers', 'Cloth', 'Armour and main colour', 'Metals', 'Leather, bone and small parts', 'Weapons', 'Details', 'Finishing', 'Base'] as const

// Checked in this order (most specific first); the stage is the index in STAGES.
const RULES: [RegExp, number][] = [
  [/\b(prep|preparation|prim(e|er|ing)|undercoat(ing)?|assembly|zenithal)\b/, 0],
  [/\b(bases?|basing|rim|ground|terrain|rocks?|stones? base)\b(?! ?coat)/, 9],
  [/\b(varnish|weathering|surface finish|chipping|battle damage|mud|rust)\b/, 8],
  [/\b(eyes?|lens(es)?|gems?|glow|hazard|freehand|crux|decals?|transfers?|purity seals?|wax|parchment|scrolls?|optics?|visor|details?|markings?|pattern|chequered|spirit stones?|candles?|rosary|grenades?|beads)\b/, 7],
  [/\b(weapons?|guns?|swords?|blades?|axes?|bolters?|rifles?|casing|lasguns?|pistols?|cannons?)\b/, 6],
  [/\b(gold|silver|steel|brass|bronze|copper|metals?|metallics?|iron|chainmail|living metal|gunmetal)\b/, 4],
  [/\b(leather|pouch(es)?|belts?|straps?|wood|rubber|tubing|cables?|pipes?|bones?|horns?|claws?|talons?|skulls?|teeth|tongue|bandages?|feathers?|fur|hair|boots?|gloves?)\b/, 5],
  [/\b(skin|flesh|face|body|muscles?|undersuit|fatigues|uniform|inner|tentacles?|quills?|membranes?|wings?)\b/, 1],
  [/\b(cloth|robes?|cloaks?|tabards?|capes?|loincloth|banners?|sash|hood|trousers|fabric|clothes|(?<!base )coat|tunic|scarf)\b/, 2],
  [/\b(armou?r|carapace|chitin(ous)?|plates?|panels?|shell|hull|vehicle|helmets?)\b/, 3],
]

export function areaStage(area: string): number | undefined {
  const a = area.toLowerCase()
  return RULES.find(([re]) => re.test(a))?.[1]
}

/** Areas sorted for painting. An area we can't place stays right after the area before it. */
/** `stage` is missing for areas we can't place. */
export function paintingOrder(sections: SchemeSection[]): { section: SchemeSection; stage?: string }[] {
  let last = 0
  const ranked = sections.map((section, i) => {
    const s = areaStage(section.area)
    if (s !== undefined) last = s
    return { section, rank: s ?? last, known: s !== undefined, i }
  })
  return ranked.sort((a, b) => a.rank - b.rank || a.i - b.i).map(({ section, rank, known }) => (known ? { section, stage: STAGES[rank] } : { section }))
}

/** The techniques a scheme uses, in the order they first appear, with their guide when there is one. */
export function techniquesUsed(scheme: PaintScheme): { name: string; guide?: Technique }[] {
  const seen = new Map<string, { name: string; guide?: Technique }>()
  for (const sec of scheme.sections)
    for (const st of sec.steps) {
      const name = st.technique.trim()
      if (!name) continue
      const guide = techniqueFor(name)
      const key = guide?.id ?? name.toLowerCase()
      if (!seen.has(key)) seen.set(key, { name: guide?.name ?? name, guide })
    }
  return [...seen.values()]
}

export function paintCount(scheme: PaintScheme): number {
  return new Set(scheme.sections.flatMap((s) => s.steps.flatMap((st) => st.paints.map((p) => p.paintId)))).size
}

const HARD = new Set(['glaze', 'wetblend', 'stipple', 'sponge', 'weathering'])
const EXPERT = new Set(['freehand', 'wetblend'])

/** 1–5: the scheme's own value, or a guess from its techniques and length. */
export function difficulty(scheme: PaintScheme): number {
  if (scheme.difficulty) return scheme.difficulty
  const ids = new Set(techniquesUsed(scheme).map((t) => t.guide?.id))
  const steps = scheme.sections.reduce((n, s) => n + s.steps.length, 0)
  let d = 1
  if (['layer', 'highlight', 'edge highlight'].some((t) => ids.has(t))) d++
  if ([...HARD].some((t) => ids.has(t))) d++
  if ([...EXPERT].some((t) => ids.has(t))) d++
  if (steps > 40) d++
  return Math.min(d, 5)
}

export const DIFFICULTY_LABEL = ['', 'Beginner', 'Easy', 'Intermediate', 'Advanced', 'Expert']
