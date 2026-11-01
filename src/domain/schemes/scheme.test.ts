import { describe, expect, it } from 'vitest'
import type { PaintDef, PaintStock } from '../paints/types'
import {
  addSection, addStep, colourStrip, createScheme, duplicateStep, makeVariant, missingPaints, moveStep, paintIdsOf,
  parseSchemeFile, removeStep, schemeFile, updateStep, validateScheme, variantDiff,
} from './scheme'

let n = 0
const ctx = (now = '2026-11-02T00:00:00.000Z') => ({ now, newId: () => `id${++n}` })

function ultramarines() {
  let s = createScheme({ name: 'Ultramarines', origin: 'official', factionName: 'Ultramarines', stage: 'final', source: { title: 'Studio scheme' } }, ctx())
  s = addSection(s, 'Armour', ctx())
  const sec = s.sections[0].id
  s = addStep(s, sec, { technique: 'basecoat', paints: [{ paintId: 'c/macragge' }] }, ctx())
  s = addStep(s, sec, { technique: 'shade', paints: [{ paintId: 'c/nuln', parts: 1 }, { paintId: 'c/lahmian', parts: 2 }], thinning: 'glaze' }, ctx())
  s = addStep(s, sec, { technique: 'edge highlight', paints: [{ paintId: 'c/calgar' }] }, ctx())
  return s
}

describe('createScheme', () => {
  it('fills defaults and validates', () => {
    const s = createScheme({ name: ' My scheme ', stage: 'idea' }, ctx())
    expect(s).toMatchObject({ name: 'My scheme', origin: 'personal', description: '', tags: [], tips: '', tutorials: [], sections: [] })
    expect(() => createScheme({ name: ' ', stage: 'idea' }, ctx())).toThrow(/name/)
    expect(() => createScheme({ name: 'X', stage: 'idea', difficulty: 7 }, ctx())).toThrow(/difficulty/)
  })
  it('community schemes need a source link or author', () => {
    expect(() => createScheme({ name: 'X', stage: 'idea', origin: 'community' }, ctx())).toThrow(/source/)
    expect(createScheme({ name: 'X', stage: 'idea', origin: 'community', source: { url: 'https://example.com' } }, ctx()).origin).toBe('community')
  })
})

describe('steps', () => {
  it('adds sections and steps in order', () => {
    const s = ultramarines()
    expect(s.sections[0].steps.map((x) => x.technique)).toEqual(['basecoat', 'shade', 'edge highlight'])
  })
  it('moves, duplicates, updates and removes steps', () => {
    let s = ultramarines()
    const [a, b, c] = s.sections[0].steps.map((x) => x.id)
    s = moveStep(s, c, -1, ctx())
    expect(s.sections[0].steps.map((x) => x.id)).toEqual([a, c, b])
    s = moveStep(s, a, -1, ctx()) // already first: no change
    expect(s.sections[0].steps[0].id).toBe(a)
    s = duplicateStep(s, b, ctx())
    expect(s.sections[0].steps).toHaveLength(4)
    expect(s.sections[0].steps.map((x) => x.technique)).toEqual(['basecoat', 'edge highlight', 'shade', 'shade']) // copy right after
    expect(s.sections[0].steps[3].id).not.toBe(b)
    s = updateStep(s, b, { note: 'thin coats' }, ctx())
    expect(s.sections[0].steps.find((x) => x.id === b)?.note).toBe('thin coats')
    s = removeStep(s, b, ctx())
    expect(s.sections[0].steps).toHaveLength(3)
  })
  it('rejects bad mix ratios', () => {
    const s = ultramarines()
    expect(() => updateStep(s, s.sections[0].steps[0].id, { paints: [{ paintId: 'x', parts: 0 }] }, ctx())).toThrow(/ratio/)
  })
})

describe('paints of a scheme', () => {
  const paints: PaintDef[] = [
    { id: 'c/macragge', brand: 'Citadel', name: 'Macragge Blue', hex: '#0d407f' },
    { id: 'c/nuln', brand: 'Citadel', name: 'Nuln Oil', hex: '#14100e' },
    { id: 'c/calgar', brand: 'Citadel', name: 'Calgar Blue', hex: '#4272b8' },
  ]
  const stock = (paintId: string, quantity: number, stage = 'in-use'): PaintStock => ({ paintId, stage, quantity, favourite: false, notes: '', updatedAt: 't' })

  it('lists unique paints in order of use', () => {
    expect(paintIdsOf(ultramarines())).toEqual(['c/macragge', 'c/nuln', 'c/lahmian', 'c/calgar'])
  })
  it('colour strip uses known paints only', () => {
    expect(colourStrip(ultramarines(), paints)).toEqual(['#0d407f', '#14100e', '#4272b8'])
  })
  it('missing = no pots (wishlist or empty count as missing)', () => {
    const stocks = new Map([
      ['c/macragge', stock('c/macragge', 1)],
      ['c/nuln', stock('c/nuln', 0, 'empty')],
    ])
    expect(missingPaints(ultramarines(), stocks)).toEqual(['c/nuln', 'c/lahmian', 'c/calgar'])
  })
})

describe('variants', () => {
  it('makes a personal copy with new ids, linked to the original', () => {
    const base = ultramarines()
    const v = makeVariant(base, ctx('2026-11-03T00:00:00.000Z'))
    expect(v).toMatchObject({ name: 'Ultramarines (my variant)', origin: 'personal', basedOn: base.id, stage: 'idea', factionName: 'Ultramarines' })
    expect(v.source).toBeUndefined()
    expect(v.id).not.toBe(base.id)
    expect(v.sections[0].id).not.toBe(base.sections[0].id)
    expect(v.sections[0].steps.map((x) => x.technique)).toEqual(['basecoat', 'shade', 'edge highlight'])
  })
  it('shows which paints were added or dropped compared with the original', () => {
    const base = ultramarines()
    let v = makeVariant(base, ctx())
    v = updateStep(v, v.sections[0].steps[2].id, { paints: [{ paintId: 'c/fenrisian' }] }, ctx())
    expect(variantDiff(v, base)).toEqual({ added: ['c/fenrisian'], removed: ['c/calgar'] })
  })
})

describe('scheme files', () => {
  it('round-trips a scheme and its paint names for sharing', () => {
    const s = ultramarines()
    const text = schemeFile([s], [{ id: 'c/macragge', brand: 'Citadel', name: 'Macragge Blue', hex: '#0d407f' }], 'now')
    const back = parseSchemeFile(text, ctx())
    expect(back.schemes).toHaveLength(1)
    expect(back.schemes[0]).toMatchObject({ name: 'Ultramarines', origin: 'official' })
    expect(back.schemes[0].id).not.toBe(s.id) // new ids on import, never overwrites
    expect(back.paints).toEqual([{ id: 'c/macragge', brand: 'Citadel', name: 'Macragge Blue', hex: '#0d407f' }])
  })
  it('rejects other files', () => {
    expect(() => parseSchemeFile('nope', ctx())).toThrow(/JSON/)
    expect(() => parseSchemeFile('{"format":"x"}', ctx())).toThrow(/scheme file/)
  })
  it('validateScheme catches broken data', () => {
    expect(() => validateScheme({ ...ultramarines(), name: '' })).toThrow(/name/)
  })
})
