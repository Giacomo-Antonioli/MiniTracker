import { describe, expect, it } from 'vitest'
import type { PaintScheme } from '../schemes/types'
import { missingForSchemes } from './missing'
import type { PaintDef, PaintStock } from './types'

const paint = (id: string, brand: string, name: string): PaintDef => ({ id, brand, name, hex: '#000' })
const scheme = (name: string, ids: string[]) =>
  ({ id: name, name, sections: [{ id: 's', area: 'Armour', steps: [{ id: 't', paints: ids.map((paintId) => ({ paintId })) }] }] }) as unknown as PaintScheme

describe('missingForSchemes', () => {
  it('lists unowned paints once, sorted by brand and name, with the schemes that use them', () => {
    const paints = [paint('a', 'Citadel', 'Mephiston Red'), paint('b', 'Citadel', 'Abaddon Black'), paint('c', 'Vallejo', 'Black'), paint('d', 'Army Painter', 'Matt White'), paint('e', 'Citadel', 'Averland Sunset')]
    const stocks = new Map<string, PaintStock>([['a', { paintId: 'a', quantity: 1 } as PaintStock], ['c', { paintId: 'c', quantity: 0 } as PaintStock]])
    const rows = missingForSchemes([scheme('Red', ['a', 'e', 'b', 'y', 'x']), scheme('Dark', ['b', 'c', 'd'])], paints, stocks)
    expect(rows.map((r) => [r.paint?.name ?? r.paintId, r.schemes])).toEqual([
      ['Matt White', ['Dark']],
      ['Abaddon Black', ['Red', 'Dark']],
      ['Averland Sunset', ['Red']],
      ['Black', ['Dark']],
      ['x', ['Red']],
      ['y', ['Red']],
    ])
    expect(missingForSchemes([], paints, stocks)).toEqual([])
  })
})
