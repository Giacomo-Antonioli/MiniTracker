import { describe, expect, it } from 'vitest'
import type { PaintDef } from '../paints/types'
import { buildDraft, detectTechnique, matchPaint, normaliseBrand } from './extract'

const paints: PaintDef[] = [
  { id: 'citadel/the-fang', brand: 'Citadel', name: 'The Fang', hex: '#4a667b' },
  { id: 'citadel/athonian-camoshade', brand: 'Citadel', name: 'Athonian Camoshade', hex: '#5c7a13' },
  { id: 'citadel/lahmian-medium', brand: 'Citadel', name: 'Lahmian Medium', hex: '#eeeeee' },
  { id: 'citadel/skrag-brown', brand: 'Citadel', name: 'Skrag Brown', hex: '#8b4806' },
  { id: 'citadel/zamesi-desert', brand: 'Citadel', name: 'Zamesi Desert', hex: '#d0a35a' },
  { id: 'vallejo/black', brand: 'Vallejo', name: 'Black', hex: '#000000' },
  { id: 'army_painter/matt-black', brand: 'Army Painter', name: 'Matt Black', hex: '#000000' },
  { id: 'citadel/tau-light-ochre', brand: 'Citadel', name: "Tau Light Ochre", hex: '#bf6e1d' },
]

describe('normaliseBrand', () => {
  it('maps range names to our brands', () => {
    expect(normaliseBrand('Citadel Painting System')).toBe('Citadel')
    expect(normaliseBrand('Vallejo Game Color')).toBe('Vallejo')
    expect(normaliseBrand('The Army Painter Warpaints')).toBe('Army Painter')
    expect(normaliseBrand('AK Interactive 3rd Gen')).toBe('AK Interactive')
    expect(normaliseBrand('Squidmar Color')).toBe('Squidmar Color')
  })
})

describe('matchPaint', () => {
  it('matches by brand and name, ignoring case and apostrophes', () => {
    expect(matchPaint('the fang', 'Citadel', paints)).toBe('citadel/the-fang')
    expect(matchPaint("T'au Light Ochre", undefined, paints)).toBe('citadel/tau-light-ochre')
  })
  it('uses the brand to resolve common names', () => {
    expect(matchPaint('Black', 'Vallejo', paints)).toBe('vallejo/black')
  })
  it('tolerates small spelling slips in long names', () => {
    expect(matchPaint('Zemesi Desert', 'Citadel', paints)).toBe('citadel/zamesi-desert')
    expect(matchPaint('Athonian Camoshad', undefined, paints)).toBe('citadel/athonian-camoshade')
  })
  it('returns undefined when nothing is close', () => {
    expect(matchPaint('Ceramite White', 'Citadel', paints)).toBeUndefined()
    expect(matchPaint('Red', undefined, paints)).toBeUndefined()
  })
})

describe('detectTechnique', () => {
  it.each([
    ['Basecoat with The Fang', 'basecoat'],
    ['Base coat the armour', 'basecoat'],
    ['Wash with Athonian Camoshade', 'shade'],
    ['Edge highlight the upper edges', 'edge highlight'],
    ['Dot highlight with Pale Sand', 'edge highlight'],
    ['Drybrush with Screaming Skull', 'drybrush'],
    ['Glaze the upper plates', 'glaze'],
    ['Prime grey', 'prime'],
    ['Highlight with Nurgling Green', 'highlight'],
    ['Layer with Loren Forest', 'layer'],
    ['Paint the lenses fully', ''],
  ])('%s → %s', (text, t) => expect(detectTechnique(text)).toBe(t))
})

describe('buildDraft', () => {
  it('turns headings and steps into areas and steps with matched paints', () => {
    const d = buildDraft(
      [
        { type: 'step', text: 'Prime grey' },
        { type: 'heading', text: 'Green Armor' },
        { type: 'step', text: 'Wash with Athonian Camoshade', paints: [{ name: 'Athonian Camoshade', brand: 'Citadel Painting System' }] },
        { type: 'heading', text: "T'au skin" },
        { type: 'step', text: 'Basecoat with The Fang', paints: [{ name: 'The Fang', brand: 'Citadel Painting System' }] },
        { type: 'step', text: 'Glaze with Kelshan Purple', paints: [{ name: 'Kelshan Purple', brand: 'Squidmar Color', hex: '#55335a' }] },
      ],
      paints,
    )
    expect(d.sections.map((s) => s.area)).toEqual(['Preparation', 'Green Armor', "T'au skin"])
    expect(d.sections[0].steps[0]).toMatchObject({ technique: 'prime', paints: [] })
    expect(d.sections[1].steps[0]).toMatchObject({ technique: 'shade', paints: [{ paintId: 'citadel/athonian-camoshade' }] })
    expect(d.sections[2].steps[1].paints[0].paintId).toBe('lib/squidmar-color/kelshan-purple')
    expect(d.newPaints).toEqual([{ id: 'lib/squidmar-color/kelshan-purple', brand: 'Squidmar Color', name: 'Kelshan Purple', hex: '#55335a', custom: true }])
    expect(d.stats).toEqual({ steps: 4, paints: 3, matched: 2 })
  })

  it('finds paints and mix ratios in free text when no structure is given', () => {
    const d = buildDraft(
      [
        { type: 'heading', text: 'Armour' },
        { type: 'step', text: 'Paint all armour with Tau Light Ochre in three thin coats.' },
        { type: 'step', text: 'Mix 4 parts Lahmian Medium to 1 part Skrag Brown and glaze the upper plates.' },
      ],
      paints,
    )
    expect(d.sections[0].steps[0].paints).toEqual([{ paintId: 'citadel/tau-light-ochre' }])
    expect(d.sections[0].steps[1]).toMatchObject({
      technique: 'glaze',
      paints: [{ paintId: 'citadel/lahmian-medium', parts: 4 }, { paintId: 'citadel/skrag-brown', parts: 1 }],
    })
  })

  it('splits several paints without mixing words into consecutive steps; recipes without headings use "Steps"', () => {
    const d = buildDraft(
      [{ type: 'step', text: 'Edge highlight with Skrag Brown, Zamesi Desert', paints: [{ name: 'Skrag Brown' }, { name: 'Zamesi Desert' }] }],
      paints,
    )
    expect(d.sections).toEqual([
      { area: 'Steps', steps: [
        { technique: 'edge highlight', paints: [{ paintId: 'citadel/skrag-brown' }], note: '' },
        { technique: 'edge highlight', paints: [{ paintId: 'citadel/zamesi-desert' }], note: '' },
      ] },
    ])
    const mixed = buildDraft([{ type: 'step', text: 'Glaze with a 1:1 of The Fang and Lahmian Medium', paints: [{ name: 'The Fang' }, { name: 'Lahmian Medium' }] }], paints)
    expect(mixed.sections[0].steps).toHaveLength(1)
  })

  it('drops empty areas', () => {
    expect(buildDraft([{ type: 'heading', text: 'Empty' }], paints).sections).toEqual([])
  })
})
