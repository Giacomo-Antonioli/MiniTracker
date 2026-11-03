import { describe, expect, it } from 'vitest'
import { closestOwnedSubstitute, closestPaints, deltaE2000, matchLabel, parseHex, rgbToLab } from './colour'
import type { PaintDef, PaintStock } from './types'

const paint = (id: string, hex: string, extra: Partial<PaintDef> = {}): PaintDef => ({ id, brand: 'B', name: id, hex, ...extra })
const stock = (paintId: string, quantity = 1) => [paintId, { paintId, quantity } as PaintStock] as const

describe('parseHex', () => {
  it('reads long, short and bare forms', () => {
    expect(parseHex('#ff8000')).toEqual([255, 128, 0])
    expect(parseHex('F80')).toEqual([255, 136, 0])
    expect(parseHex(' #000 ')).toEqual([0, 0, 0])
  })
  it('rejects anything else', () => {
    expect(parseHex('red')).toBeUndefined()
    expect(parseHex('#12345')).toBeUndefined()
  })
})

describe('rgbToLab', () => {
  it('maps white and black', () => {
    const w = rgbToLab([255, 255, 255])
    expect(w[0]).toBeCloseTo(100, 1)
    expect(w[1]).toBeCloseTo(0, 1)
    expect(rgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 5)
  })
})

describe('deltaE2000', () => {
  // Reference pairs from Sharma, Wu, Dalal (2005).
  const cases: [number[], number[], number][] = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
    [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ]
  it.each(cases)('%j vs %j', (a, b, want) => {
    expect(deltaE2000(a as never, b as never)).toBeCloseTo(want, 3)
  })
  it('is zero for the same colour', () => expect(deltaE2000([40, 10, 10], [40, 10, 10])).toBe(0))
})

describe('closestPaints', () => {
  const paints = [paint('red', '#cc0000'), paint('darkred', '#880000'), paint('blue', '#0000cc'), paint('bad', 'nope')]
  it('sorts by distance and skips bad hex', () => {
    expect(closestPaints('#c00', paints, { n: 3 }).map((m) => m.paint.id)).toEqual(['red', 'darkred', 'blue'])
  })
  it('filters, excludes and limits', () => {
    expect(closestPaints('#c00', paints, { exclude: 'red', n: 1 }).map((m) => m.paint.id)).toEqual(['darkred'])
    expect(closestPaints('#c00', paints, { filter: (p) => p.id === 'blue' }).map((m) => m.paint.id)).toEqual(['blue'])
  })
  it('returns nothing for a bad target', () => expect(closestPaints('xyz', paints)).toEqual([]))
})

describe('closestOwnedSubstitute', () => {
  const target = paint('t', '#cc0000', { type: 'layer' })
  const paints = [target, paint('shade', '#cc0101', { type: 'shade' }), paint('layer', '#aa2222', { type: 'layer' }), paint('none', '#cc0000')]
  it('prefers an owned paint of the same type', () => {
    const stocks = new Map([stock('shade'), stock('layer'), stock('t')])
    expect(closestOwnedSubstitute(target, paints, stocks)?.paint.id).toBe('layer')
  })
  it('falls back to any owned paint, ignoring empty pots', () => {
    const stocks = new Map([stock('shade'), stock('layer', 0)])
    expect(closestOwnedSubstitute(target, paints, stocks)?.paint.id).toBe('shade')
  })
  it('works without a type and with nothing owned', () => {
    expect(closestOwnedSubstitute(paint('x', '#cc0000'), paints, new Map([stock('none')]))?.paint.id).toBe('none')
    expect(closestOwnedSubstitute(target, paints, new Map())).toBeUndefined()
  })
})

it('matchLabel', () => {
  expect([1, 3, 7, 20].map(matchLabel)).toEqual(['near identical', 'very close', 'close', 'rough'])
})
