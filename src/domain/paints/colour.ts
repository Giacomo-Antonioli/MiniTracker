import type { PaintDef, PaintStock } from './types'

type Lab = [number, number, number]

/** Parses #rgb or #rrggbb (with or without #). Undefined when not a hex colour. */
export function parseHex(hex: string): [number, number, number] | undefined {
  let h = hex.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(h)) h = [...h].map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return undefined
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

/** sRGB (0–255) to CIELAB, D65 white. */
export function rgbToLab([r, g, b]: [number, number, number]): Lab {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

/** CIEDE2000 colour difference. Below ~2 is hard to tell apart, above ~10 is clearly different. */
export function deltaE2000([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cm = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
  const ap1 = (1 + G) * a1
  const ap2 = (1 + G) * a2
  const Cp1 = Math.hypot(ap1, b1)
  const Cp2 = Math.hypot(ap2, b2)
  const hue = (b: number, a: number) => (b === 0 && a === 0 ? 0 : (deg(Math.atan2(b, a)) + 360) % 360)
  const hp1 = hue(b1, ap1)
  const hp2 = hue(b2, ap2)
  const dL = L2 - L1
  const dC = Cp2 - Cp1
  let dh = 0
  if (Cp1 * Cp2 !== 0) {
    dh = hp2 - hp1
    if (dh > 180) dh -= 360
    else if (dh < -180) dh += 360
  }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(rad(dh / 2))
  const Lm = (L1 + L2) / 2
  const Cpm = (Cp1 + Cp2) / 2
  let hm = hp1 + hp2
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) <= 180) hm /= 2
    else hm = hp1 + hp2 < 360 ? (hm + 360) / 2 : (hm - 360) / 2
  }
  const T = 1 - 0.17 * Math.cos(rad(hm - 30)) + 0.24 * Math.cos(rad(2 * hm)) + 0.32 * Math.cos(rad(3 * hm + 6)) - 0.2 * Math.cos(rad(4 * hm - 63))
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7))
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2)
  const SC = 1 + 0.045 * Cpm
  const SH = 1 + 0.015 * Cpm * T
  const RT = -Math.sin(rad(2 * dTheta)) * Rc
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))
}

export interface PaintMatch {
  paint: PaintDef
  distance: number
}

export const owns = (stocks: Map<string, PaintStock>, id: string) => (stocks.get(id)?.quantity ?? 0) > 0

/** The n paints closest to a hex colour, nearest first. Paints with a bad hex are skipped. */
export function closestPaints(hex: string, paints: PaintDef[], opts: { n?: number; filter?: (p: PaintDef) => boolean; exclude?: string } = {}): PaintMatch[] {
  const rgb = parseHex(hex)
  if (!rgb) return []
  const target = rgbToLab(rgb)
  const out: PaintMatch[] = []
  for (const p of paints) {
    if (p.id === opts.exclude || (opts.filter && !opts.filter(p))) continue
    const c = parseHex(p.hex)
    if (c) out.push({ paint: p, distance: deltaE2000(target, rgbToLab(c)) })
  }
  return out.sort((a, b) => a.distance - b.distance).slice(0, opts.n ?? 5)
}

/** Closest owned paint to stand in for a missing one; prefers the same type (shade for shade…) when you own any of that type. */
export function closestOwnedSubstitute(paint: PaintDef, paints: PaintDef[], stocks: Map<string, PaintStock>): PaintMatch | undefined {
  const owned = paints.filter((p) => p.id !== paint.id && owns(stocks, p.id))
  const sameType = paint.type ? owned.filter((p) => p.type === paint.type) : []
  return closestPaints(paint.hex, sameType.length ? sameType : owned, { n: 1 })[0]
}

/** Rough words for a distance, for the UI. */
export function matchLabel(distance: number): string {
  if (distance < 2) return 'near identical'
  if (distance < 5) return 'very close'
  if (distance < 10) return 'close'
  return 'rough'
}
