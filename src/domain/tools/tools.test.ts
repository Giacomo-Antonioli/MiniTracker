import { describe, expect, it } from 'vitest'
import { airbrushLiquids, airbrushTool, wetPaletteSet, addTask, daysLeft, dueTasks, markDone, newTool, parseTools, removeTask, toolShopItem } from './tools'

let n = 0
const at = (now: string) => ({ now, newId: () => `id${++n}` })

it('creates tools and maintenance tasks', () => {
  const c = at('2026-11-01T00:00:00Z')
  expect(() => newTool({ name: ' ', category: 'Airbrush' }, c)).toThrow()
  let t = newTool({ name: ' Infinity ', category: 'Airbrush' }, c)
  expect(t).toMatchObject({ name: 'Infinity', status: 'owned', condition: 'good', quantity: 1, lowAt: 0, tasks: [] })
  expect(() => addTask(t, { name: 'Clean', everyDays: 0 }, c)).toThrow()
  expect(() => addTask(t, { name: '', everyDays: 3 }, c)).toThrow()
  t = addTask(t, { name: 'Clean', everyDays: 7 }, c)
  expect(t.tasks).toHaveLength(1)
  expect(removeTask(t, t.tasks[0].id, c).tasks).toEqual([])
})

it('works out what maintenance is due', () => {
  const c = at('2026-11-01T00:00:00Z')
  let a = addTask(newTool({ name: 'Airbrush', category: 'Airbrush' }, c), { name: 'Clean', everyDays: 7 }, c)
  const task = a.tasks[0]
  expect(daysLeft(task, c.now)).toBe(0) // never done: due now
  a = markDone(a, task.id, c)
  expect(daysLeft(a.tasks[0], '2026-11-03T00:00:00Z')).toBe(5)
  expect(daysLeft(a.tasks[0], '2026-11-10T00:00:00Z')).toBe(-2)
  let k = addTask(newTool({ name: 'Knife', category: 'Cutting' }, c), { name: 'Blade', everyDays: 30 }, c)
  k = markDone(k, k.tasks[0].id, at('2026-10-01T00:00:00Z'))
  const wish = addTask(newTool({ name: 'Lamp', category: 'Lighting', status: 'wishlist' }, c), { name: 'Wipe', everyDays: 1 }, c)
  const due = dueTasks([a, k, wish], '2026-11-10T00:00:00Z')
  expect(due.map((d) => [d.item.name, d.daysLeft])).toEqual([['Knife', -10], ['Airbrush', -2]])
  expect(dueTasks([a], '2026-11-02T00:00:00Z')).toEqual([])
})

it('shopping item and parsing old or broken data', () => {
  const t = { ...newTool({ name: 'Clippers', category: 'Cutting', status: 'wishlist' }, at('x')), brand: 'Citadel' }
  expect(toolShopItem(t)).toEqual({ kind: 'other', name: 'Citadel Clippers', refId: `tool:${t.id}`, qty: 1, sources: ['Tools'] })
  expect(parseTools('x')).toEqual([])
  const [p] = parseTools([{ id: 'a', name: 'A', condition: 'odd', tasks: [{ id: 't', name: 'T', everyDays: 3 }, { bad: 1 }] }, { name: 'no id' }])
  expect(p).toMatchObject({ quantity: 1, lowAt: 0, category: 'Other', brand: '', status: 'owned', condition: 'good', notes: '', tasks: [{ id: 't' }] })
})

describe('airbrush and wet palette presets', () => {
  let n = 0
  const c = () => ({ now: '2026-11-14T10:00:00.000Z', newId: () => `id${++n}` })

  it('names an airbrush after its feed, action and nozzle, with notes for each choice', () => {
    const a = airbrushTool({ feed: 'gravity', action: 'dual', nozzle: 0.3 }, c())
    expect([a.name, a.category]).toEqual(['Airbrush (gravity feed, dual action, 0.3 mm)', 'Airbrush'])
    expect(a.notes).toMatch(/little paint waste.*separately.*detail/)
    const b = airbrushTool({ feed: 'siphon', action: 'single', nozzle: 0.5 }, c())
    expect(b.name).toBe('Airbrush (siphon feed, single action, 0.5 mm)')
    expect(b.notes).toMatch(/holds more paint.*together.*base coats/)
    expect(airbrushTool({ feed: 'gravity', action: 'dual', nozzle: 0.4 }, c()).notes).toMatch(/all-rounder/)
  })

  it('adds the airbrush liquids as liquids, but not the ones already there', () => {
    const all = airbrushLiquids({ supplies: [] }, c())
    expect(all.map((x) => x.name)).toEqual(['Vallejo Airbrush Thinner', 'Vallejo Airbrush Flow Improver', 'Vallejo Airbrush Cleaner', 'Vallejo Retarder Medium'])
    expect(all.every((x) => x.liquid && x.brand === 'Vallejo')).toBe(true)
    expect(airbrushLiquids({ supplies: all.slice(0, 3) }, c()).map((x) => x.name)).toEqual(['Vallejo Retarder Medium'])
  })

  it('adds the wet palette tool and its paper and sponges once', () => {
    const set = wetPaletteSet({ tools: [], supplies: [] }, c())
    expect([set.tool?.name, set.supplies.map((x) => x.quantity)]).toEqual(['AK Interactive Wet Palette', [40, 2]])
    const again = wetPaletteSet({ tools: [set.tool!], supplies: [set.supplies[0]] }, c())
    expect([again.tool, again.supplies.map((x) => x.name)]).toEqual([undefined, ['Wet palette sponges']])
  })
})
