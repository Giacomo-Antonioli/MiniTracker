import { expect, it } from 'vitest'
import { dedupeSchemes, paintSimilarity, sameRecipe } from './dedupe'
import type { PaintScheme } from './types'

const scheme = (id: string, author: string | undefined, paints: string[][]): PaintScheme =>
  ({ id, name: id, source: author ? { author } : undefined, sections: [{ id: 'a', area: 'Armour', steps: paints.map((ps, i) => ({ id: `s${i}`, technique: '', note: '', paints: ps.map((paintId) => ({ paintId })) })) }] }) as unknown as PaintScheme

const ten = Array.from({ length: 10 }, (_, i) => [`p${i}`])

it('paintSimilarity', () => {
  expect(paintSimilarity(scheme('a', 'x', [['1', '2']]), scheme('b', 'x', [['2', '3']]))).toBeCloseTo(1 / 3)
  expect(paintSimilarity(scheme('a', 'x', []), scheme('b', 'x', []))).toBe(1)
})

it('sameRecipe: same id, or same author with near-identical paints and steps', () => {
  expect(sameRecipe(scheme('a', undefined, [['1']]), scheme('a', 'y', [['2']]))).toBe(true)
  expect(sameRecipe(scheme('a', 'x', ten), scheme('b', 'x', ten))).toBe(true)
  expect(sameRecipe(scheme('a', 'x', ten), scheme('b', 'y', ten))).toBe(false)
  expect(sameRecipe(scheme('a', undefined, ten), scheme('b', undefined, ten))).toBe(false)
  expect(sameRecipe(scheme('a', 'x', ten), scheme('b', 'x', ten.slice(0, 7)))).toBe(false)
  expect(sameRecipe(scheme('a', 'x', ten), scheme('b', 'x', [...ten.slice(0, 9), ['other']]))).toBe(false)
  expect(sameRecipe(scheme('a', 'x', []), scheme('b', 'x', []))).toBe(false)
})

it('dedupeSchemes keeps the first and reports the rest', () => {
  const r = dedupeSchemes([scheme('a', 'x', ten), scheme('b', 'y', ten), scheme('a', 'x', ten), scheme('c', 'x', ten)])
  expect(r.kept.map((s) => s.id)).toEqual(['a', 'b'])
  expect(r.dropped).toEqual([{ id: 'a', name: 'a', duplicateOf: 'a' }, { id: 'c', name: 'c', duplicateOf: 'a' }])
})
