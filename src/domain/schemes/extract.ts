import type { PaintDef } from '../paints/types'
import type { SchemeSection, StepPaint } from './types'

/**
 * Turns a recipe from a web page (headings + steps, optionally with paint names already tagged)
 * into scheme areas and steps matched against our paint list. Used by the scheme library tool
 * and, later, by "add from link" in the app.
 */

export interface SourceBlock {
  type: 'heading' | 'step'
  text: string
  /** Paints tagged by the page itself (e.g. Paint Pad swatches). */
  paints?: { name: string; brand?: string; hex?: string }[]
}

const norm = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const slug = (s: string) => norm(s).replace(/ /g, '-')

export function normaliseBrand(range: string): string {
  const r = range.toLowerCase()
  if (r.includes('citadel') || r.includes('games workshop') || r.includes('warhammer colour')) return 'Citadel'
  if (r.includes('vallejo')) return 'Vallejo'
  if (r.includes('army painter')) return 'Army Painter'
  if (r.startsWith('ak ') || r.includes('ak interactive')) return 'AK Interactive'
  return range.trim()
}

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

/** Our paint id for a name (and brand, when known), allowing small spelling slips in longer names. */
export function matchPaint(name: string, brand: string | undefined, paints: PaintDef[]): string | undefined {
  const n = norm(name)
  const b = brand ? normaliseBrand(brand) : undefined
  const exact = paints.filter((p) => norm(p.name) === n)
  const pick = (list: PaintDef[]) => (b && list.find((p) => p.brand === b)) || (!b ? list.find((p) => p.brand === 'Citadel') ?? list[0] : undefined)
  const hit = pick(exact)
  if (hit) return hit.id
  if (n.length < 8) return undefined
  const close = paints.filter((p) => (!b || p.brand === b) && Math.abs(norm(p.name).length - n.length) <= 2 && distance(norm(p.name), n) <= 2)
  return pick(close)?.id ?? close[0]?.id
}

const TECHNIQUE_RULES: [RegExp, string][] = [
  [/\b(edge|dot|fine|spot)[ -]?highlight/i, 'edge highlight'],
  [/\bdry[ -]?brush/i, 'drybrush'],
  [/\b(wash|shade|recess)/i, 'shade'],
  [/\bglaze/i, 'glaze'],
  [/\b(prime|primer|undercoat|zenithal)/i, 'prime'],
  [/\bcontrast\b/i, 'contrast'],
  [/\bwet[ -]?blend/i, 'wetblend'],
  [/\bstipple/i, 'stipple'],
  [/\bvarnish/i, 'varnish'],
  [/\bbase[ -]?coat|\bbase\b/i, 'basecoat'],
  [/\bhighlight/i, 'highlight'],
  [/\blayer/i, 'layer'],
]

export function detectTechnique(text: string): string {
  return TECHNIQUE_RULES.find(([re]) => re.test(text))?.[1] ?? ''
}

/** Paints mentioned in free text, longest names first, with "N parts X" ratios. */
function paintsInText(text: string, paints: PaintDef[]): StepPaint[] {
  const t = ` ${norm(text)} `
  const names = [...paints].sort((a, b) => b.name.length - a.name.length)
  const found: { id: string; at: number; name: string }[] = []
  let rest = t
  for (const p of names) {
    const key = ` ${norm(p.name)} `
    if (key.trim().length < 4) continue
    const at = rest.indexOf(key)
    if (at >= 0 && !found.some((f) => f.id === p.id)) {
      found.push({ id: p.id, at, name: norm(p.name) })
      rest = rest.slice(0, at) + ' '.repeat(key.length) + rest.slice(at + key.length)
    }
  }
  return found
    .sort((a, b) => a.at - b.at)
    .map((f) => {
      const m = t.match(new RegExp(`(\\d+) parts? ${f.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `))
      return m ? { paintId: f.id, parts: Number(m[1]) } : { paintId: f.id }
    })
}

export interface Draft {
  sections: Omit<SchemeSection, 'id'>[] & { steps: { technique: string; paints: StepPaint[]; note: string }[] }[]
  /** Paints that aren't in our list, to add as library/custom paints. */
  newPaints: PaintDef[]
  stats: { steps: number; paints: number; matched: number }
}

/** Words that mean several paints are mixed together (otherwise they are used one after another). */
const MIX = /\b(mix|mixed|mixture|parts?|ratio|blend of)\b|\d\s*:\s*\d/i

export function buildDraft(blocks: SourceBlock[], paints: PaintDef[]): Draft {
  const hasHeadings = blocks.some((b) => b.type === 'heading')
  const sections: { area: string; steps: { technique: string; paints: StepPaint[]; note: string }[] }[] = []
  const newPaints = new Map<string, PaintDef>()
  const seen = new Set<string>()
  let matched = 0
  let current: (typeof sections)[number] | null = null

  for (const b of blocks) {
    if (b.type === 'heading') {
      current = { area: b.text.trim(), steps: [] }
      sections.push(current)
      continue
    }
    if (!current) {
      current = { area: hasHeadings ? 'Preparation' : 'Steps', steps: [] }
      sections.push(current)
    }
    let stepPaints: StepPaint[]
    if (b.paints?.length) {
      stepPaints = b.paints.map((p) => {
        const id = matchPaint(p.name, p.brand, paints)
        if (id) {
          if (!seen.has(id)) matched++
          seen.add(id)
          return { paintId: id }
        }
        const brand = p.brand ? normaliseBrand(p.brand) : 'Unknown'
        const libId = `lib/${slug(brand)}/${slug(p.name)}`
        if (!newPaints.has(libId)) newPaints.set(libId, { id: libId, brand, name: p.name.trim(), hex: p.hex ?? '#888888', custom: true })
        seen.add(libId)
        return { paintId: libId }
      })
    } else {
      stepPaints = paintsInText(b.text, paints)
      for (const p of stepPaints) {
        if (!seen.has(p.paintId)) matched++
        seen.add(p.paintId)
      }
    }
    const technique = detectTechnique(b.text)
    if (stepPaints.length > 1 && !MIX.test(b.text)) {
      // "Edge highlight with A, B, C" = three steps in sequence.
      for (const p of stepPaints) current.steps.push({ technique, paints: [p], note: '' })
    } else {
      current.steps.push({ technique, paints: stepPaints, note: '' })
    }
  }

  const kept = sections.filter((s) => s.steps.length > 0)
  return {
    sections: kept as Draft['sections'],
    newPaints: [...newPaints.values()],
    stats: { steps: kept.reduce((n, s) => n + s.steps.length, 0), paints: seen.size, matched },
  }
}

/**
 * For whole web pages (bookmarklet, pasted text): keep only steps that use a paint, drop empty areas.
 * Pages contain lots of prose; a step without any paint is almost always noise.
 */
export function draftFromPage(blocks: SourceBlock[], paints: PaintDef[]): Draft {
  const d = buildDraft(blocks, paints)
  const sections = d.sections.map((s) => ({ ...s, steps: s.steps.filter((st) => st.paints.length > 0) })).filter((s) => s.steps.length > 0)
  const used = new Set(sections.flatMap((s) => s.steps.flatMap((st) => st.paints.map((p) => p.paintId))))
  return {
    sections: sections as Draft['sections'],
    newPaints: d.newPaints.filter((p) => used.has(p.id)),
    stats: { steps: sections.reduce((n, s) => n + s.steps.length, 0), paints: used.size, matched: [...used].filter((id) => !id.startsWith('lib/')).length },
  }
}

/** Pasted text → blocks: short lines without a full stop or a technique word look like headings. */
export function blocksFromText(text: string): SourceBlock[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').trim()).filter(Boolean)
  const looksLikeHeading = (l: string) => l.length <= 40 && !/[.!?:]$/.test(l) && !/\d/.test(l) && !detectTechnique(l)
  return lines.map((l) => (looksLikeHeading(l) ? { type: 'heading' as const, text: l } : { type: 'step' as const, text: l }))
}
