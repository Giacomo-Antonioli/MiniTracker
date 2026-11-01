import type { Ctx } from '../collection/types'
import type { PaintDef, PaintStock } from './types'

const HEX = /^#[0-9a-f]{6}$/i

export function createCustomPaint(input: { brand: string; name: string; hex: string; type?: string; family?: string }, ctx: Ctx): PaintDef {
  const name = input.name.trim()
  const brand = input.brand.trim()
  if (!name) throw new Error('Paint name is required')
  if (!brand) throw new Error('Paint brand is required')
  if (!HEX.test(input.hex)) throw new Error('Paint colour must be a hex value like #3a5f9e')
  return {
    id: `custom/${ctx.newId()}`,
    brand,
    name,
    hex: input.hex.toLowerCase(),
    ...(input.type ? { type: input.type } : {}),
    ...(input.family ? { family: input.family } : {}),
    custom: true,
  }
}

/** Stages where you don't have the pot (yet). */
const NOT_IN_HAND = new Set(['wishlist', 'ordered'])

export function newStock(paintId: string, stage: string, ctx: Pick<Ctx, 'now'>): PaintStock {
  return { paintId, stage, quantity: NOT_IN_HAND.has(stage) ? 0 : 1, favourite: false, notes: '', updatedAt: ctx.now }
}

export function adjustQuantity(s: PaintStock, delta: number, ctx: Pick<Ctx, 'now'>): PaintStock {
  return { ...s, quantity: Math.max(0, s.quantity + delta), updatedAt: ctx.now }
}

export function updateStock(s: PaintStock, patch: Partial<Omit<PaintStock, 'paintId' | 'updatedAt'>>, ctx: Pick<Ctx, 'now'>): PaintStock {
  if (patch.quantity !== undefined && (!Number.isInteger(patch.quantity) || patch.quantity < 0)) throw new RangeError('Invalid quantity')
  if (patch.rating !== undefined && (!Number.isInteger(patch.rating) || patch.rating < 1 || patch.rating > 5)) throw new RangeError('Invalid rating (1–5)')
  if (patch.price !== undefined && (!Number.isFinite(patch.price) || patch.price < 0)) throw new RangeError('Invalid price')
  return { ...s, ...patch, updatedAt: ctx.now }
}

export interface PaintFilter {
  text?: string
  brand?: string
  type?: string
  family?: string
  stage?: string
  ownedOnly?: boolean
  favouritesOnly?: boolean
}

export function filterPaints(paints: PaintDef[], stocks: Map<string, PaintStock>, f: PaintFilter): PaintDef[] {
  const words = (f.text ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  return paints.filter((p) => {
    const s = stocks.get(p.id)
    if (f.brand && p.brand !== f.brand) return false
    if (f.type && p.type !== f.type) return false
    if (f.family && p.family !== f.family) return false
    if (f.stage && s?.stage !== f.stage) return false
    if (f.ownedOnly && !(s && s.quantity > 0)) return false
    if (f.favouritesOnly && !s?.favourite) return false
    if (words.length) {
      const hay = `${p.name} ${p.brand}`.toLowerCase()
      if (!words.every((w) => hay.includes(w))) return false
    }
    return true
  })
}

export function paintStats(paints: PaintDef[], stocks: Map<string, PaintStock>, lowStage = 'low') {
  const brandOf = new Map(paints.map((p) => [p.id, p.brand]))
  let owned = 0
  let pots = 0
  let value = 0
  let low = 0
  let wishlist = 0
  const byBrand: Record<string, number> = {}
  for (const s of stocks.values()) {
    if (s.stage === lowStage) low++
    if (s.stage === 'wishlist') wishlist++
    if (s.quantity <= 0) continue
    owned++
    pots += s.quantity
    value += (s.price ?? 0) * s.quantity
    const b = brandOf.get(s.paintId) ?? 'Other'
    byBrand[b] = (byBrand[b] ?? 0) + 1
  }
  return { owned, pots, value: Math.round(value * 100) / 100, low, wishlist, byBrand }
}
