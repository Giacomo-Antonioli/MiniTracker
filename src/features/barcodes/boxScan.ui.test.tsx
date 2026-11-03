// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, ctx, useStore } from '../../app/store'
import { createUnit } from '../../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'
import { DEFAULT_LAYOUT } from '../../domain/home/layout'
import { EMPTY_STORAGE } from '../../domain/storage/storage'

const CODE = '5011921170005'

beforeEach(async () => {
  localStorage.setItem('startPage', 'backlog')
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], events: {}, homeLayout: DEFAULT_LAYOUT, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES, catalogue: null, shopItems: [], shopLists: [], storage: EMPTY_STORAGE, barcodes: [], companion: null })
})
afterEach(() => vi.unstubAllGlobals())

it('unknown box: looks it up, suggests a datasheet, teaches; known box shows ownership and ticks shopping', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 1, product: { product_name: "T'au Empire Commander" } }) })))
  const c = ctx()
  const u = createUnit({ customName: 'My Commander', datasheetId: 'cmd', groups: [{ count: 1, status: 'built' }] }, c)
  await appDb.units.put(u)
  const user = userEvent.setup()
  render(<App />)
  await waitFor(() => expect(useStore.getState().ready).toBe(true))
  useStore.setState({ catalogue: { datasheets: [{ id: 'cmd', name: 'Commander Farsight' }, { id: 'cr', name: 'Crisis Battlesuits' }] } as never })
  await useStore.getState().addToShopping([{ kind: 'model', name: 'Commander Farsight', refId: 'cmd', qty: 1 }], [])

  await user.click(await screen.findByRole('button', { name: '📷 Scan box' }))
  await user.type(screen.getByLabelText('Type a code or barcode'), 'U-001{enter}')
  expect(await screen.findByText(/not a box barcode/)).toBeTruthy()
  await user.clear(screen.getByLabelText('Type a code or barcode'))
  await user.type(screen.getByLabelText('Type a code or barcode'), `${CODE}{enter}`)
  const form = within(await screen.findByRole('form', { name: 'Teach box' }))
  expect(await form.findByText(/Open Products Facts says/)).toBeTruthy()
  expect(form.getByText(/Games Workshop/)).toBeTruthy()
  expect(form.getByRole('link', { name: /Barcode Spider/ }).getAttribute('href')).toBe(`https://www.barcodespider.com/${CODE}`)
  expect(form.getByRole('link', { name: /UPCitemdb/ }).getAttribute('href')).toBe(`https://www.upcitemdb.com/upc/${CODE}`)
  await waitFor(() => expect((form.getByLabelText('Datasheet 1') as HTMLSelectElement).value).toBe('cmd'))
  expect((form.getByLabelText('Box name') as HTMLInputElement).value).toBe("T'au Empire Commander")
  await user.click(form.getByRole('button', { name: '+ Another unit in the box' }))
  await user.click(form.getByRole('button', { name: 'Save box' }))
  expect(form.getByRole('alert').textContent).toMatch(/name/)
  await user.selectOptions(form.getByLabelText('Datasheet 2'), 'cr')
  await user.clear(form.getByLabelText('Models 2'))
  await user.type(form.getByLabelText('Models 2'), '3')
  await user.click(form.getByRole('button', { name: 'Remove unit 2' }))
  await user.click(form.getByRole('button', { name: 'Save box' }))

  const box = within(await screen.findByLabelText('Box status'))
  expect(box.getByText(/You own 1 model/)).toBeTruthy()
  expect(box.getByText('My Commander')).toBeTruthy()
  await user.click(box.getByRole('button', { name: '✓ Mark bought' }))
  await waitFor(() => expect(useStore.getState().shopItems[0].bought).toBe(true))
  await user.click(box.getByRole('button', { name: 'Edit box' }))
  await user.clear(screen.getByLabelText('Box name'))
  await user.type(screen.getByLabelText('Box name'), 'Commander box')
  await user.click(screen.getByRole('button', { name: 'Save box' }))
  await waitFor(() => expect(useStore.getState().barcodes[0].name).toBe('Commander box'))
  useStore.setState({ catalogue: null })
  await user.click(await screen.findByRole('button', { name: 'My Commander' }))
  expect(await screen.findByRole('heading', { name: 'My Commander' })).toBeTruthy()
})

it('Storage scanner opens a box from a barcode; unknown product offline', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Storage' }))
  await user.type(screen.getByLabelText('Find code'), `${CODE}{enter}`)
  const form = within(await screen.findByRole('form', { name: 'Teach box' }))
  expect(await form.findByText(/Not found in Open Products Facts/)).toBeTruthy()
  await user.type(form.getByLabelText('Box name'), 'Mystery')
  await user.type(form.getByLabelText('Unit 1'), 'Drones')
  await user.click(form.getByRole('button', { name: 'Save box' }))
  expect(await screen.findByText(/don’t own any yet/)).toBeTruthy()
})
