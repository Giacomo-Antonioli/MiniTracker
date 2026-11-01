import type { Ctx } from '../collection/types'
import type { PaintDef, PaintStock } from '../paints/types'
import type { PaintScheme, SchemeOrigin, SchemeSection, SchemeStep, StepPaint } from './types'

/** Suggestions for the technique field (free text is allowed). */
export const TECHNIQUES = [
  'prime', 'zenithal', 'basecoat', 'contrast', 'shade', 'wash', 'recess shade', 'layer', 'highlight', 'edge highlight',
  'drybrush', 'glaze', 'wetblend', 'stipple', 'sponge', 'details', 'freehand', 'weathering', 'basing', 'varnish',
]

/** Suggestions for section areas. */
export const AREAS = ['Armour', 'Cloth', 'Skin', 'Metal', 'Gold', 'Leather', 'Weapons', 'Eyes / lenses', 'Gems', 'Banner', 'Base', 'Rim']

export type NewScheme = Partial<Omit<PaintScheme, 'id' | 'createdAt' | 'updatedAt' | 'sections'>> & { name: string; stage: string }

export function validateScheme(s: PaintScheme): void {
  if (!s.name.trim()) throw new Error('Scheme name is required')
  if (s.difficulty !== undefined && (!Number.isInteger(s.difficulty) || s.difficulty < 1 || s.difficulty > 5)) throw new RangeError('Invalid difficulty (1–5)')
  if (s.minutesPerModel !== undefined && (!Number.isFinite(s.minutesPerModel) || s.minutesPerModel < 0)) throw new RangeError('Invalid time per model')
  if (s.origin === 'community' && !s.source?.url?.trim() && !s.source?.author?.trim()) throw new Error('Community schemes need a source link or author')
  for (const sec of s.sections) for (const st of sec.steps) validatePaints(st.paints)
}

function validatePaints(paints: StepPaint[]) {
  for (const p of paints) if (p.parts !== undefined && (!Number.isFinite(p.parts) || p.parts <= 0)) throw new RangeError('Invalid mix ratio')
}

export function createScheme(input: NewScheme, ctx: Ctx): PaintScheme {
  const s: PaintScheme = {
    description: '',
    origin: 'personal' as SchemeOrigin,
    tags: [],
    tips: '',
    tutorials: [],
    ...input,
    name: input.name.trim(),
    sections: [],
    id: ctx.newId(),
    createdAt: ctx.now,
    updatedAt: ctx.now,
  }
  validateScheme(s)
  return s
}

const touch = (s: PaintScheme, ctx: Pick<Ctx, 'now'>, sections = s.sections): PaintScheme => ({ ...s, sections, updatedAt: ctx.now })

const mapSteps = (s: PaintScheme, fn: (steps: SchemeStep[], sec: SchemeSection) => SchemeStep[]) =>
  s.sections.map((sec) => ({ ...sec, steps: fn(sec.steps, sec) }))

export function addSection(s: PaintScheme, area: string, ctx: Ctx): PaintScheme {
  return touch(s, ctx, [...s.sections, { id: ctx.newId(), area: area.trim() || 'Area', steps: [] }])
}

export function updateSection(s: PaintScheme, sectionId: string, area: string, ctx: Ctx): PaintScheme {
  return touch(s, ctx, s.sections.map((sec) => (sec.id === sectionId ? { ...sec, area } : sec)))
}

export function removeSection(s: PaintScheme, sectionId: string, ctx: Ctx): PaintScheme {
  return touch(s, ctx, s.sections.filter((sec) => sec.id !== sectionId))
}

export function moveSection(s: PaintScheme, sectionId: string, delta: number, ctx: Ctx): PaintScheme {
  return touch(s, ctx, moveIn(s.sections, sectionId, delta))
}

export function addStep(s: PaintScheme, sectionId: string, step: Partial<Omit<SchemeStep, 'id'>>, ctx: Ctx): PaintScheme {
  const full: SchemeStep = { technique: '', paints: [], note: '', ...step, id: ctx.newId() }
  validatePaints(full.paints)
  return touch(s, ctx, mapSteps(s, (steps, sec) => (sec.id === sectionId ? [...steps, full] : steps)))
}

export function updateStep(s: PaintScheme, stepId: string, patch: Partial<Omit<SchemeStep, 'id'>>, ctx: Ctx): PaintScheme {
  if (patch.paints) validatePaints(patch.paints)
  return touch(s, ctx, mapSteps(s, (steps) => steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st))))
}

export function removeStep(s: PaintScheme, stepId: string, ctx: Ctx): PaintScheme {
  return touch(s, ctx, mapSteps(s, (steps) => steps.filter((st) => st.id !== stepId)))
}

export function duplicateStep(s: PaintScheme, stepId: string, ctx: Ctx): PaintScheme {
  return touch(
    s,
    ctx,
    mapSteps(s, (steps) => {
      const i = steps.findIndex((st) => st.id === stepId)
      if (i < 0) return steps
      const copy = { ...structuredClone(steps[i]), id: ctx.newId() }
      return [...steps.slice(0, i + 1), copy, ...steps.slice(i + 1)]
    }),
  )
}

export function moveStep(s: PaintScheme, stepId: string, delta: number, ctx: Ctx): PaintScheme {
  return touch(s, ctx, mapSteps(s, (steps) => (steps.some((st) => st.id === stepId) ? moveIn(steps, stepId, delta) : steps)))
}

function moveIn<T extends { id: string }>(list: T[], id: string, delta: number): T[] {
  const i = list.findIndex((x) => x.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= list.length) return list
  const out = [...list]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

/** Every paint used, in order of first use. */
export function paintIdsOf(s: PaintScheme): string[] {
  return [...new Set(s.sections.flatMap((sec) => sec.steps.flatMap((st) => st.paints.map((p) => p.paintId))))]
}

/** Swatch colours of the scheme's paints (unknown paints skipped). */
export function colourStrip(s: PaintScheme, paints: PaintDef[]): string[] {
  const byId = new Map(paints.map((p) => [p.id, p.hex]))
  return paintIdsOf(s).map((id) => byId.get(id)).filter((h): h is string => !!h)
}

/** Paints of the scheme you have no pots of. */
export function missingPaints(s: PaintScheme, stocks: Map<string, PaintStock>): string[] {
  return paintIdsOf(s).filter((id) => !((stocks.get(id)?.quantity ?? 0) > 0))
}

/** Your own copy of any scheme, linked to the original. */
export function makeVariant(base: PaintScheme, ctx: Ctx): PaintScheme {
  const copy = structuredClone(base)
  return {
    ...copy,
    id: ctx.newId(),
    name: `${base.name} (my variant)`,
    origin: 'personal',
    basedOn: base.id,
    stage: 'idea',
    source: undefined,
    coverPhotoId: undefined,
    sections: copy.sections.map((sec) => ({ ...sec, id: ctx.newId(), steps: sec.steps.map((st) => ({ ...st, id: ctx.newId() })) })),
    createdAt: ctx.now,
    updatedAt: ctx.now,
  }
}

/** Paints added to or dropped from a variant compared with its original. */
export function variantDiff(variant: PaintScheme, base: PaintScheme): { added: string[]; removed: string[] } {
  const a = new Set(paintIdsOf(variant))
  const b = new Set(paintIdsOf(base))
  return { added: [...a].filter((x) => !b.has(x)), removed: [...b].filter((x) => !a.has(x)) }
}

const FILE_FORMAT = 'minitracker-schemes'

/** Shareable file: schemes plus the paints they use (so friends see names and colours). */
export function schemeFile(schemes: PaintScheme[], paints: PaintDef[], now: string): string {
  const used = new Set(schemes.flatMap(paintIdsOf))
  return JSON.stringify(
    { format: FILE_FORMAT, version: 1, exportedAt: now, schemes: schemes.map((s) => ({ ...s, coverPhotoId: undefined })), paints: paints.filter((p) => used.has(p.id)) },
    null,
    2,
  )
}

/** Read a shared scheme file. Imported schemes get new ids, so they never overwrite yours. */
export function parseSchemeFile(text: string, ctx: Ctx): { schemes: PaintScheme[]; paints: PaintDef[] } {
  let raw: { format?: string; schemes?: PaintScheme[]; paints?: PaintDef[] }
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON')
  }
  if (raw?.format !== FILE_FORMAT || !Array.isArray(raw.schemes)) throw new Error('This is not a MiniTracker scheme file')
  const idMap = new Map(raw.schemes.map((s) => [s.id, ctx.newId()]))
  const schemes = raw.schemes.map((s) => {
    const fresh: PaintScheme = {
      ...s,
      id: idMap.get(s.id)!,
      basedOn: s.basedOn ? idMap.get(s.basedOn) : undefined,
      sections: s.sections.map((sec) => ({ ...sec, id: ctx.newId(), steps: sec.steps.map((st) => ({ ...st, id: ctx.newId() })) })),
      createdAt: ctx.now,
      updatedAt: ctx.now,
    }
    validateScheme(fresh)
    return fresh
  })
  return { schemes, paints: Array.isArray(raw.paints) ? raw.paints : [] }
}
