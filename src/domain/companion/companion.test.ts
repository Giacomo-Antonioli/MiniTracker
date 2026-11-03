import { expect, it } from 'vitest'
import type { OwnedUnit } from '../collection/types'
import type { PaintScheme } from '../schemes/types'
import { buildChecklist, clearTicks, paintChecklist, parseTicks, toggleTick } from './companion'

it('ticks', () => {
  let t = toggleTick({}, 'u', 'a')
  t = toggleTick(t, 'u', 'b')
  expect(t).toEqual({ u: ['a', 'b'] })
  expect(toggleTick(toggleTick(t, 'u', 'a'), 'u', 'b')).toEqual({})
  expect(clearTicks({ u: ['paint:1', 'magnet:x'] }, 'u', 'paint:')).toEqual({ u: ['magnet:x'] })
  expect(clearTicks({ u: ['paint:1'] }, 'u', 'paint:')).toEqual({})
  expect(parseTicks(null)).toEqual({})
  expect(parseTicks([1])).toEqual({})
  expect(parseTicks({ u: ['a'], v: 'x', w: [1] })).toEqual({ u: ['a'] })
})

it('paint checklist follows painting order and adds technique tips', () => {
  const s = { sections: [
    { id: 's2', area: 'Base', steps: [{ id: 'b1', technique: 'Drybrush', paints: [{ paintId: 'p2' }], note: 'rim' }] },
    { id: 's1', area: 'Armour', steps: [{ id: 'a1', technique: 'Basecoat', paints: [{ paintId: 'p1' }], thinning: '1:1', note: '' }, { id: 'a2', technique: '', paints: [], note: '' }] },
  ] } as unknown as PaintScheme
  const c = paintChecklist(s)
  expect(c.map((x) => x.key)).toEqual(['paint:a1', 'paint:a2', 'paint:b1'])
  expect(c[0]).toMatchObject({ area: 'Armour', label: 'Basecoat', detail: '1:1', paintIds: ['p1'] })
  expect(c[1]).toMatchObject({ label: 'Step', detail: undefined, tip: undefined })
  expect(c[2].tip).toBeTruthy()
})

it('build checklist from loadout and magnets', () => {
  const u = { groups: [
    { id: 'g', count: 2, loadout: ['Bolter'], magnetised: [{ slot: 'Arm', optionIds: ['a', 'b'] }] },
    { id: 'h', count: 1, loadout: [], magnetised: [] },
  ] } as unknown as OwnedUnit
  expect(buildChecklist(u)).toEqual([
    { key: 'wargear:g:Bolter', label: '2× Bolter' },
    { key: 'magnet:g:Arm', label: '🧲 2× Arm', detail: 'a | b' },
  ])
  expect(buildChecklist({ groups: [u.groups[0]] } as OwnedUnit)[0].label).toBe('Bolter')
})
