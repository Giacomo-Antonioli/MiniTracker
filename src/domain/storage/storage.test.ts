import { describe, expect, it } from 'vitest'
import {
  FLOW_DESK, FLOW_PACKED, FLOW_STORED, kindOf, removeSite, saveKinds, saveSite, setFlow, siteOf, sitePlaces,
  checkOut, checkedOutTo, descendants, EMPTY_STORAGE, fill, homedIn, parseStorage, pathLabel, pickList, placePath, pruneStorage, putBack, putBackList,
  removePlace, savePlace, setHome, unitLog, validatePlace, whereIs, type Place, type Storage,
} from './storage'

let n = 0
const c = { now: '2026-11-03T10:00:00Z', newId: () => `m${++n}` }
const place = (id: string, name: string, parentId?: string, extra: Partial<Place> = {}): Place => ({ id, name, kind: 'box', parentId, location: '', note: '', createdAt: '', ...extra })

function world(): Storage {
  let s = EMPTY_STORAGE
  s = savePlace(s, place('shelf', 'Shelf 2', undefined, { kind: 'shelf' }))
  s = savePlace(s, place('box', 'Sprues', 'shelf', { capacity: 10 }))
  s = savePlace(s, place('bag', 'Bag 7', 'box', { kind: 'bag' }))
  s = savePlace(s, place('case', 'Travel case', undefined, { kind: 'case', capacity: 4 }))
  s = savePlace(s, place('a', 'Box 10'))
  return s
}

describe('places', () => {
  it('paths and nesting', () => {
    const s = world()
    expect(placePath(s, 'bag').map((p) => p.id)).toEqual(['shelf', 'box', 'bag'])
    expect(pathLabel(s, 'bag', 3)).toBe('Shelf 2 › Sprues › Bag 7 · slot 3')
    expect([...descendants(s, 'shelf')].sort()).toEqual(['bag', 'box', 'shelf'])
    expect(placePath(s, 'nope')).toEqual([])
  })
  it('validates', () => {
    const s = world()
    expect(() => validatePlace(s, place('x', ' '))).toThrow(/name/)
    expect(() => validatePlace(s, place('x', 'X', undefined, { capacity: 0 }))).toThrow(/Slots/)
    expect(() => validatePlace(s, { ...s.places[0], parentId: 'bag' })).toThrow(/inside itself/)
    expect(() => validatePlace(s, place('x', 'X', 'ghost'))).toThrow(/Unknown/)
    expect(savePlace(s, { ...s.places[1], name: ' Renamed ' }).places[1].name).toBe('Renamed')
  })
  it('remove moves children up, clears homes and returns checked-out units', () => {
    let s = setHome(world(), 'u1', { placeId: 'box', slot: 2 }, c)
    s = setHome(s, 'u2', { placeId: 'a' }, c)
    s = checkOut(s, ['u2'], 'box', c)
    s = removePlace(s, 'box', c)
    expect(s.places.find((p) => p.id === 'bag')?.parentId).toBe('shelf')
    expect(s.homes.u1).toBeUndefined()
    expect(s.out.u2).toBeUndefined()
    expect(removePlace(s, 'ghost', c)).toBe(s)
  })
})

describe('homes and check-outs', () => {
  it('slots, fill, sprue bag with several units', () => {
    let s = setHome(world(), 'u1', { placeId: 'box', slot: 1 }, c)
    s = setHome(s, 'u2', { placeId: 'box', slot: 1 }, c)
    s = setHome(s, 'u3', { placeId: 'box' }, c)
    expect(fill(s, 'box')).toMatchObject({ used: 2, capacity: 10 })
    expect(fill(s, 'box').free[0]).toBe(2)
    expect(fill(s, 'bag')).toEqual({ used: 0, capacity: undefined, free: [] })
    expect(homedIn(s, 'box').map((x) => x.unitId)).toEqual(['u1', 'u2', 'u3'])
    expect(() => setHome(s, 'u1', { placeId: 'box', slot: 11 }, c)).toThrow(/Slot/)
    expect(() => setHome(s, 'u1', { placeId: 'ghost' }, c)).toThrow(/Unknown/)
    expect(setHome(s, 'u3', undefined, c).homes.u3).toBeUndefined()
  })
  it('check out keeps home, put back returns, all logged', () => {
    let s = setHome(world(), 'u1', { placeId: 'bag', slot: 4 }, c)
    s = checkOut(s, ['u1', 'u2'], 'case', c)
    expect(checkOut(s, ['u1'], 'case', c).log).toHaveLength(s.log.length)
    expect(() => checkOut(s, ['u1'], 'ghost', c)).toThrow()
    expect(whereIs(s, 'u1')).toEqual({ placeId: 'case', out: true })
    expect(checkedOutTo(s, 'case')).toEqual(['u1', 'u2'])
    s = putBack(s, ['u1', 'u9'], c)
    expect(whereIs(s, 'u1')).toEqual({ placeId: 'bag', slot: 4, out: false })
    expect(unitLog(s, 'u1').map((m) => m.kind).sort()).toEqual(['back', 'home', 'out'])
  })
})

it('pick list in shelf › box › slot order, ready and unstored apart; put-back list', () => {
  let s = world()
  s = setHome(s, 'u1', { placeId: 'a', slot: 2 }, c)
  s = setHome(s, 'u2', { placeId: 'bag', slot: 5 }, c)
  s = setHome(s, 'u3', { placeId: 'a', slot: 1 }, c)
  s = setHome(s, 'u4', { placeId: 'a' }, c)
  s = checkOut(s, ['u5'], 'case', c)
  const p = pickList(s, ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u1'], 'case')
  expect(p.stops.map((x) => x.path)).toEqual(['Box 10', 'Shelf 2 › Sprues › Bag 7'])
  expect(p.stops[0].items.map((x) => x.unitId)).toEqual(['u3', 'u1', 'u4'])
  expect(p.ready).toEqual(['u5'])
  expect(p.unstored).toEqual(['u6'])
  s = checkOut(s, ['u1', 'u2'], 'case', c)
  const back = putBackList(s, 'case')
  expect(back.stops.map((x) => x.placeId)).toEqual(['a', 'bag'])
  expect(back.unstored).toEqual(['u5'])
})

it('prune and parse', () => {
  let s = setHome(world(), 'u1', { placeId: 'a' }, c)
  s = checkOut(s, ['gone'], 'case', c)
  const p = pruneStorage(s, new Set(['u1']))
  expect(Object.keys(p.out)).toEqual([])
  expect(p.log.every((m) => m.unitId === 'u1')).toBe(true)
  expect(parseStorage(null)).toEqual(EMPTY_STORAGE)
  expect(parseStorage({ places: [{ id: 'x', name: 'X', kind: 'weird' }, { id: 1 }], homes: [], out: 'x', log: 'x' })).toMatchObject({ sites: [], flow: {}, places: [{ id: 'x', name: 'X', kind: 'box', location: '', note: '' }], homes: {}, out: {}, log: [] })
  expect(parseStorage({ homes: { u: { placeId: 'a' } }, out: { u: 'b' }, log: [] })).toMatchObject({ places: [], homes: { u: { placeId: 'a' } }, out: { u: 'b' } })
})

it('sites, kinds and storage flow', () => {
  let s = world()
  expect(pathLabel(s, 'bag')).toBe('Shelf 2 › Sprues › Bag 7')
  expect(() => saveSite(s, { id: 'x', name: ' ', address: '', note: '' })).toThrow(/name/)
  s = saveSite(s, { id: 'home', name: ' Home ', address: '', note: '' })
  s = saveSite(s, { id: 'club', name: 'Club', address: 'Via Roma 1', note: '' })
  s = saveSite(s, { ...s.sites[1], note: 'locker 4' })
  s = savePlace(s, { ...s.places.find((p) => p.id === 'case')!, siteId: 'club' })
  expect(siteOf(s, 'bag')?.name).toBe('Home')
  expect(pathLabel(s, 'bag')).toBe('Home › Shelf 2 › Sprues › Bag 7')
  expect(sitePlaces(s, 'club').map((p) => p.id)).toEqual(['case'])
  expect(sitePlaces(s, 'home').map((p) => p.id).sort()).toEqual(['a', 'shelf'])
  s = removeSite(s, 'club')
  expect(s.places.find((p) => p.id === 'case')?.siteId).toBe('home')
  expect(removeSite(s, 'ghost')).toBe(s)

  expect(kindOf(s, 'bag').icon).toBeTruthy()
  expect(kindOf(s, 'odd')).toMatchObject({ name: 'odd' })
  expect(() => saveKinds(s, [])).toThrow(/one/)
  expect(() => saveKinds(s, [{ id: 'a', name: ' ', icon: '' }])).toThrow(/name/)
  expect(() => saveKinds(s, [{ id: 'a', name: 'A', icon: '' }, { id: 'a', name: 'B', icon: '' }])).toThrow(/different/)
  expect(() => saveKinds(s, s.kinds.filter((k) => k.id !== 'bag'))).toThrow(/Bag/)
  expect(saveKinds(s, [...s.kinds, { id: 'mag', name: 'Magnetic tray', icon: '🧲' }]).kinds.at(-1)?.id).toBe('mag')

  s = savePlace(s, place('desk', 'Desk', undefined, { kind: 'desk' }))
  s = checkOut(s, ['u1'], 'desk', c)
  expect(s.flow.u1).toBe(FLOW_DESK)
  s = checkOut(s, ['u1'], 'case', c)
  expect(s.flow.u1).toBe(FLOW_PACKED)
  s = putBack(s, ['u1'], c)
  expect(s.flow.u1).toBe(FLOW_STORED)
  expect(setFlow(s, ['u1'], undefined).flow).toEqual({})
  expect(setFlow(s, ['u1'], 'lent').flow.u1).toBe('lent')
})
