import { expect, it } from 'vitest'
import { assignCodes, codeFromText, codeLink, findCode, modelCodes, normCode, placePrefix, stencilChars, stencilPath } from './codes'
import { EMPTY_STORAGE, parseStorage, type Storage } from './storage'

const s0: Storage = { ...EMPTY_STORAGE, places: [
  { id: 'b', name: 'Box', kind: 'box', location: '', note: '', createdAt: '' },
  { id: 'g', name: 'Bag', kind: 'bag', location: '', note: '', createdAt: '' },
  { id: 'x', name: 'Odd', kind: 'weird-kind', location: '', note: '', createdAt: '' },
] }

it('assigns stable codes per prefix', () => {
  let s = assignCodes(s0, ['u1', 'u2'], ['b', 'g', 'x', 'ghost'])
  expect(s.codes).toEqual({ u1: 'U-001', u2: 'U-002', b: 'B-01', g: 'B-02', x: 'P-01' })
  s = assignCodes(s, ['u1', 'u3'], ['b'])
  expect(s.codes.u1).toBe('U-001')
  expect(s.codes.u3).toBe('U-003')
  expect(placePrefix('Shelf')).toBe('S')
  expect(placePrefix('Underbed')).toBe('P')
  expect(placePrefix('Mag tray')).toBe('P')
  expect(parseStorage({ codes: { a: 'U-001' } }).codes).toEqual({ a: 'U-001' })
})

it('finds codes from typed text, links and scans', () => {
  const s = assignCodes(s0, ['u1'], ['b'])
  expect(normCode(' u 001 ')).toBe('U-001')
  expect(findCode(s, 'u001')).toEqual({ kind: 'unit', id: 'u1' })
  expect(findCode(s, 'B-01')).toEqual({ kind: 'place', id: 'b' })
  expect(findCode(s, 'Z-9')).toBeUndefined()
  const link = codeLink('https://x.io/MiniTracker/#old', 'U-001')
  expect(link).toBe('https://x.io/MiniTracker/#code=U-001')
  expect(codeFromText(link)).toBe('U-001')
  expect(codeFromText('b01')).toBe('B-01')
  expect(codeFromText('hello')).toBeUndefined()
})

it('stencil font draws every prefix and digit', () => {
  for (const c of 'ABCDEFGHJLNOPRSTUY0123456789-') expect(stencilChars).toContain(c)
  const p = stencilPath('U-001', 10)
  expect(p.d.length).toBeGreaterThan(50)
  expect(p.width).toBeGreaterThan(20)
  expect(stencilPath('N', 10).d).toMatch(/L/)
  expect(stencilPath('?', 10).d).toBe('')
})

it('gives each model of a unit its own code that leads back to the unit', () => {
  const s = assignCodes(s0, ['u1'], ['b'])
  expect(modelCodes('U-001', 3)).toEqual(['U-001-1', 'U-001-2', 'U-001-3'])
  expect(modelCodes('U-001', 1)).toEqual(['U-001'])
  expect(modelCodes('U-001', 0)).toEqual(['U-001'])
  expect(findCode(s, 'u001-2')).toEqual({ kind: 'unit', id: 'u1' })
  expect(findCode(s, 'U-001-2')).toEqual({ kind: 'unit', id: 'u1' })
  expect(findCode(s, 'B-01-2')).toBeUndefined()
  expect(codeFromText(codeLink('https://x.io/', 'U-001-2'))).toBe('U-001-2')
  expect(codeFromText('u001-12')).toBe('U-001-12')
  expect(stencilPath('U-001-2', 6).width).toBeGreaterThan(stencilPath('U-001', 6).width)
})
