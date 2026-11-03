import { describe, expect, it } from 'vitest'
import type { PaintScheme, SchemeSection } from '../schemes/types'
import { areaStage, difficulty, paintCount, paintingOrder, techniquesUsed } from './prepare'

let n = 0
const sec = (area: string, steps: [string, string[]][] = [['basecoat', ['p/a']]]): SchemeSection => ({
  id: `a${++n}`, area, steps: steps.map(([technique, paints]) => ({ id: `s${++n}`, technique, paints: paints.map((paintId) => ({ paintId })), note: '' })),
})
const scheme = (sections: SchemeSection[], extra: Partial<PaintScheme> = {}) =>
  ({ id: 'x', name: 'X', origin: 'mine', stage: 'final', tags: [], tips: '', tutorials: [], sections, createdAt: '', updatedAt: '', ...extra }) as PaintScheme

describe('painting order', () => {
  it('places common areas, most specific word first', () => {
    expect(areaStage('Priming')).toBe(0)
    expect(areaStage('Gold (armour trim)')).toBe(4)
    expect(areaStage('Black weapon casing')).toBe(6)
    expect(areaStage('Red (details - lenses)')).toBe(7)
    expect(areaStage('Ork skin')).toBe(1)
    expect(areaStage('Base')).toBe(9)
    expect(areaStage('Base coat')).toBeUndefined()
    expect(areaStage('Something odd')).toBeUndefined()
  })

  it('sorts prep → skin → armour → metals → details → base, keeping unknown areas after their neighbour', () => {
    const order = paintingOrder([sec('Base'), sec('Lenses'), sec('Blue armour'), sec('Highlights'), sec('Gold'), sec('Skin'), sec('Priming')])
    expect(order.map((o) => o.section.area)).toEqual(['Priming', 'Skin', 'Blue armour', 'Highlights', 'Gold', 'Lenses', 'Base'])
    expect(order[2].stage).toBe('Armour and main colour')
    expect(order[3].stage).toBeUndefined()
  })

  it('keeps the recipe order when nothing is known', () => {
    expect(paintingOrder([sec('Steps'), sec('More')]).map((o) => o.section.area)).toEqual(['Steps', 'More'])
  })
})

describe('summary', () => {
  const s = scheme([sec('Armour', [['basecoat', ['p/a']], ['Wash', ['p/b']], ['edge highlight', ['p/a', 'p/c']]]), sec('Cloth', [['juggle', []], ['', []]])])

  it('lists techniques once, with guides', () => {
    expect(techniquesUsed(s).map((t) => [t.name, !!t.guide])).toEqual([['Basecoat', true], ['Shading / washing', true], ['Edge highlighting', true], ['juggle', false]])
  })

  it('counts distinct paints', () => {
    expect(paintCount(s)).toBe(3)
  })

  it('guesses difficulty from techniques and length, unless the scheme sets it', () => {
    expect(difficulty(scheme([sec('A')]))).toBe(1)
    expect(difficulty(s)).toBe(2)
    expect(difficulty(scheme([sec('A', [['layer', []], ['glaze', []], ['wet blend', []]])]))).toBe(4)
    expect(difficulty(scheme([sec('A', Array.from({ length: 41 }, () => ['freehand', []] as [string, string[]]))]))).toBe(3)
    expect(difficulty(scheme([sec('A')], { difficulty: 5 }))).toBe(5)
  })
})
