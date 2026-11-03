import { expect, it } from 'vitest'
import data from '../../data/guides/terrain.json'
import type { BaseRecipe } from './bases'
import { terrainKinds } from './terrain'

it('finds terrain surfaces in text', () => {
  expect(terrainKinds('Sandstone Walls & Statue')).toEqual(['stone', 'walls'])
  expect(terrainKinds('Green Pipes and Wires')).toEqual(['pipes'])
  expect(terrainKinds('Plasma Glow effect')).toEqual(['glow'])
})

it('ships hand-written and credited terrain recipes with unique ids', () => {
  const t = (data as { terrain: BaseRecipe[] }).terrain
  expect(t.filter((r) => r.origin === 'minitracker')).toHaveLength(5)
  expect(t.filter((r) => r.origin === 'community').every((r) => r.source?.url)).toBe(true)
  expect(new Set(t.map((r) => r.id)).size).toBe(t.length)
})
