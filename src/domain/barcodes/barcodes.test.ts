import { expect, it, vi } from 'vitest'
import type { OwnedUnit } from '../collection/types'
import type { ShopItem } from '../shopping/types'
import { boxStatus, isBarcode, isGamesWorkshop, lookupProduct, parseMappings, saveMapping, suggestDatasheets, validateMapping, type BoxMapping } from './barcodes'

const m: BoxMapping = { code: '5011921170005', name: 'Commander', contents: [{ datasheetId: 'cmd', name: 'Commander', models: 1 }], createdAt: '' }

it('barcodes', () => {
  expect(isBarcode('5011921170005')).toBe(true)
  expect(isBarcode('5011921170006')).toBe(false)
  expect(isBarcode('96385074')).toBe(true)
  expect(isBarcode('036000291452')).toBe(true)
  expect(isBarcode('U-001')).toBe(false)
  expect(isGamesWorkshop('5011921170005')).toBe(true)
})

it('validate and save', () => {
  expect(() => validateMapping({ ...m, code: '123' })).toThrow(/barcode/)
  expect(() => validateMapping({ ...m, name: ' ' })).toThrow(/name/)
  expect(() => validateMapping({ ...m, contents: [] })).toThrow(/at least/)
  expect(() => validateMapping({ ...m, contents: [{ name: ' ', models: 1 }] })).toThrow(/name/)
  expect(() => validateMapping({ ...m, contents: [{ name: 'x', models: 0 }] })).toThrow(/Models/)
  let list = saveMapping([], m)
  list = saveMapping(list, { ...m, name: ' Big ' })
  expect(list).toEqual([{ ...m, name: 'Big' }])
  expect(parseMappings('x')).toEqual([])
  expect(parseMappings([m, { code: 1 }])).toEqual([m])
})

it('suggests datasheets from a product name', () => {
  const sheets = [{ id: 'a', name: 'Commander in Coldstar Battlesuit' }, { id: 'b', name: 'Commander Farsight' }, { id: 'c', name: 'Crisis Battlesuits' }]
  expect(suggestDatasheets('T’au Empire Commander', sheets).map((x) => x.id)).toEqual(['b', 'a'])
  expect(suggestDatasheets('Warhammer 40000', sheets)).toEqual([])
  expect(suggestDatasheets('Crisis Battlesuits', sheets)[0].id).toBe('c')
})

it('box status: owned models, units, open shopping lines', () => {
  const units = [{ id: 'u', datasheetId: 'cmd', customName: 'Cmdr' }, { id: 'v', customName: 'Drones' }] as OwnedUnit[]
  const shop = [{ id: 's', kind: 'model', refId: 'cmd', name: 'Commander', bought: false }, { id: 't', kind: 'model', name: 'drones', bought: false }, { id: 'z', kind: 'model', refId: 'cmd', bought: true }] as ShopItem[]
  const st = boxStatus({ ...m, contents: [...m.contents, { name: 'Drones', models: 2 }] }, units, shop, () => 3)
  expect(st.map((x) => [x.owned, x.units.length, x.shopping.map((i) => i.id)])).toEqual([[3, 1, ['s']], [3, 1, ['t']]])
})

it('looks up Open Products Facts', async () => {
  const ok = vi.fn(async () => ({ ok: true, json: async () => ({ status: 1, product: { product_name: ' Commander ' } }) }))
  expect(await lookupProduct('1', ok as never)).toBe('Commander')
  expect(await lookupProduct('1', (async () => ({ ok: true, json: async () => ({ status: 0 }) })) as never)).toBeUndefined()
  expect(await lookupProduct('1', (async () => ({ ok: false })) as never)).toBeUndefined()
  expect(await lookupProduct('1', (async () => { throw new Error('offline') }) as never)).toBeUndefined()
})
