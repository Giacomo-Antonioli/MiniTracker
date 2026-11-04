import type { Storage } from './storage'

/**
 * Short codes for units and places (#10): "U-007" for units, "B-03" for a box, etc.
 * Codes go on QR stickers, stencils or are written under bases; scanning or typing one opens the item.
 */
export type CodeTarget = { kind: 'unit' | 'place'; id: string }

/** Letters the stencil font can draw; a place kind whose initial isn't here uses P. */
const PREFIXES = 'ABCDEFGHJLNOPRSTUY'

export function placePrefix(kindName: string): string {
  const c = kindName.trim().charAt(0).toUpperCase()
  return PREFIXES.includes(c) && c !== 'U' ? c : 'P'
}

const next = (used: string[], prefix: string, width: number) => {
  const n = Math.max(0, ...used.filter((c) => c.startsWith(prefix + '-')).map((c) => Number(c.slice(prefix.length + 1)) || 0)) + 1
  return `${prefix}-${String(n).padStart(width, '0')}`
}

/** Gives a code to each listed unit and place that has none; existing codes never change. */
export function assignCodes(s: Storage, unitIds: string[], placeIds: string[]): Storage {
  const codes = { ...s.codes }
  const used = () => Object.values(codes)
  for (const u of unitIds) if (!codes[u]) codes[u] = next(used(), 'U', 3)
  for (const id of placeIds) {
    const p = s.places.find((x) => x.id === id)
    if (p && !codes[id]) codes[id] = next(used(), placePrefix(s.kinds.find((k) => k.id === p.kind)?.name ?? p.kind), 2)
  }
  return { ...s, codes }
}

export const normCode = (text: string) => text.trim().toUpperCase().replace(/\s+/g, '').replace(/^([A-Z])(\d)/, '$1-$2')

export function findCode(s: Storage, text: string): CodeTarget | undefined {
  const code = normCode(text)
  const byCode = (c: string) => Object.keys(s.codes).find((k) => s.codes[k] === c)
  // a model code (U-001-2) leads to its unit
  const id = byCode(code) ?? (/^U-\d+-\d+$/.test(code) ? byCode(code.replace(/-\d+$/, '')) : undefined)
  if (!id) return undefined
  return { kind: s.places.some((p) => p.id === id) ? 'place' : 'unit', id }
}

/** One code per model of a unit: U-001-1 … U-001-n; a single model keeps the unit code. */
export const modelCodes = (unitCode: string, models: number): string[] =>
  models > 1 ? Array.from({ length: models }, (_, i) => `${unitCode}-${i + 1}`) : [unitCode]

/** The link a QR holds: the app address with #code=… */
export const codeLink = (base: string, code: string) => `${base.replace(/#.*$/, '')}#code=${encodeURIComponent(code)}`

/** Reads a code from a scanned QR text or a #code=… hash; plain codes pass through. */
export function codeFromText(text: string): string | undefined {
  const m = /#code=([^&\s]+)/.exec(text)
  if (m) return normCode(decodeURIComponent(m[1]))
  return /^[A-Za-z]-?\d+(-\d+)?$/.test(text.trim()) ? normCode(text) : undefined
}

/*
 * Stencil font: each glyph is a set of separate strokes on a 4×6 grid that never touch,
 * so a cut stencil has no loose islands (the bridges are the gaps between strokes).
 */
type Seg = [number, number, number, number]
const H = (y: number, x0 = 0.6, x1 = 3.4): Seg => [x0, y, x1, y]
const V = (x: number, y0: number, y1: number): Seg => [x, y0, x, y1]
const top = H(0), mid = H(3), bot = H(6)
const tl = V(0, 0.6, 2.4), bl = V(0, 3.6, 5.4), tr = V(4, 0.6, 2.4), br = V(4, 3.6, 5.4)
const GLYPHS: Record<string, Seg[]> = {
  '0': [top, bot, tl, bl, tr, br],
  '1': [V(2, 0.6, 2.4), V(2, 3.6, 5.4), H(0, 1, 1.6)],
  '2': [top, tr, mid, bl, bot],
  '3': [top, tr, mid, br, bot],
  '4': [tl, mid, tr, br],
  '5': [top, tl, mid, br, bot],
  '6': [top, tl, mid, bl, br, bot],
  '7': [top, tr, br],
  '8': [top, tl, tr, mid, bl, br, bot],
  '9': [top, tl, tr, mid, br, bot],
  '-': [H(3, 1, 3)],
  A: [top, tl, tr, mid, bl, br],
  // B: one long left bar (an 8 has two), shorter middle bar
  B: [H(0, 0.6, 3), V(0, 0.6, 5.4), V(3.6, 0.6, 2.4), H(3, 0.6, 2.8), br, H(6, 0.6, 3.4)],
  C: [top, tl, bl, bot],
  D: [H(0, 0.6, 3), tl, bl, H(6, 0.6, 3), V(4, 1, 5)],
  E: [top, tl, mid, bl, bot],
  F: [top, tl, mid, bl],
  G: [top, tl, bl, bot, br, H(3, 2.2, 3.4)],
  H: [tl, bl, tr, br, mid],
  J: [tr, br, bot, bl],
  L: [tl, bl, bot],
  N: [tl, bl, tr, br, [0.6, 0.8, 3.4, 5.2]],
  O: [top, bot, tl, bl, tr, br],
  P: [top, tl, tr, mid, bl],
  R: [top, tl, tr, mid, bl, [1.6, 3.6, 3.6, 5.6]],
  S: [top, tl, mid, br, bot],
  T: [top, V(2, 0.6, 5.6)],
  U: [tl, bl, tr, br, bot],
  Y: [tl, tr, mid, V(2, 3.6, 5.6)],
}

/** SVG path of a code in the stencil font; height `h` (any unit), strokes `w` wide in grid units. */
export function stencilPath(code: string, h: number, w = 0.9): { d: string; width: number } {
  const k = h / (6 + w)
  let x = 0
  const parts: string[] = []
  for (const ch of code.toUpperCase()) {
    for (const [x0, y0, x1, y1] of GLYPHS[ch] ?? []) {
      // a stroke is a rectangle around the segment
      const horiz = y0 === y1
      const vert = x0 === x1
      const r = w / 2
      if (horiz || vert) {
        const ax = Math.min(x0, x1) - (vert ? r : 0), bx = Math.max(x0, x1) + (vert ? r : 0)
        const ay = Math.min(y0, y1) - (horiz ? r : 0), by = Math.max(y0, y1) + (horiz ? r : 0)
        parts.push(`M${f((x + ax + r) * k)} ${f((ay + r) * k)}H${f((x + bx + r) * k)}V${f((by + r) * k)}H${f((x + ax + r) * k)}Z`)
      } else {
        // diagonal: a parallelogram
        parts.push(`M${f((x + x0 - r + r) * k)} ${f((y0 + r) * k)}L${f((x + x0 + r + r) * k)} ${f((y0 + r) * k)}L${f((x + x1 + r + r) * k)} ${f((y1 + r) * k)}L${f((x + x1 - r + r) * k)} ${f((y1 + r) * k)}Z`)
      }
    }
    x += 4 + w + 1.4
  }
  return { d: parts.join(''), width: (x - 1.4) * k }
}

const f = (n: number) => String(Math.round(n * 100) / 100)

export const stencilChars = Object.keys(GLYPHS)
