import { expect, it } from 'vitest'
import data from '../../data/guides/bases.json'
import type { BaseRecipe } from './bases'
import { MATERIALS, materialsFor } from './materials'

const bases = (data as { bases: BaseRecipe[] }).bases
const byName = (n: string) => bases.find((b) => b.name === n)!

it('lists the materials a base uses', () => {
  expect(materialsFor(byName('Grassy meadow')).map((m) => m.id)).toEqual(expect.arrayContaining(['texture-paste', 'static-grass', 'tufts', 'pva']))
  expect(materialsFor(byName('Snowy tundra')).map((m) => m.id)).toEqual(expect.arrayContaining(['texture-paste', 'rocks', 'snow']))
  expect(materialsFor(byName('Desert sand')).map((m) => m.id)).toEqual(['texture-paste'])
  expect(materialsFor(byName('Ash wastes')).map((m) => m.id)).toEqual(['texture-paste'])
})

it('every material has a method, a maker link and a Supplies category', () => {
  expect(new Set(MATERIALS.map((m) => m.id)).size).toBe(MATERIALS.length)
  for (const m of MATERIALS) {
    expect(m.how.length, m.id).toBeGreaterThan(0)
    expect(m.brands.length, m.id).toBeGreaterThan(0)
    for (const b of m.brands) expect(b.url).toMatch(/^https:\/\//)
    expect(['Basing', 'Glue']).toContain(m.category)
  }
})
