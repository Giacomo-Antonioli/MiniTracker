// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, ctx, useStore } from '../../app/store'
import { createUnit } from '../../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'
import { DEFAULT_LAYOUT } from '../../domain/home/layout'
import { EMPTY_STORAGE, placeById, savePlace, setHome } from '../../domain/storage/storage'
import { newTool } from '../../domain/tools/tools'

beforeEach(async () => {
  localStorage.setItem('startPage', 'backlog')
  history.replaceState(null, '', '/')
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], tools: [], supplies: [], events: {}, homeLayout: DEFAULT_LAYOUT, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES, catalogue: null, shopItems: [], shopLists: [], storage: EMPTY_STORAGE, companion: null })
})

async function seed() {
  const c = ctx()
  const a = createUnit({ customName: 'Alpha', factionName: 'Orks', groups: [{ count: 1, status: 'built' }] }, c)
  const b = createUnit({ customName: 'Beta', factionName: 'Orks', groups: [{ count: 1, status: 'built' }] }, c)
  const z = createUnit({ customName: 'Zeta', factionName: 'Elves', groups: [{ count: 1, status: 'built' }] }, c)
  await appDb.units.bulkPut([a, b, z])
  const place = (id: string, name: string, capacity?: number) => ({ id, name, kind: 'box', location: '', note: '', createdAt: '', capacity })
  let s = savePlace(EMPTY_STORAGE, place('old', 'Old box', 4))
  s = savePlace(s, place('new', 'New box', 1))
  s = savePlace(s, { ...place('shelf', 'Shelf'), kind: 'shelf' })
  s = setHome(s, a.id, { placeId: 'old', slot: 1 }, c)
  s = setHome(s, b.id, { placeId: 'old', slot: 2 }, c)
  s = { ...s, codes: { old: 'B-01', new: 'B-02', [z.id]: 'U-003' } }
  await appDb.settings.put({ key: 'storage', value: s } as never)
  await appDb.settings.put({ key: 'tools', value: [{ ...newTool({ name: 'Clippers', category: 'Cutting' }, c), placeId: 'old' }] } as never)
  return { a, b, z }
}

const openPlace = async (user: ReturnType<typeof userEvent.setup>, code: string, name: string) => {
  await user.click(await screen.findByRole('button', { name: 'Storage' }))
  await user.type(screen.getByLabelText('Find code'), `${code}{enter}`)
  return within(await screen.findByRole('region', { name: `Place ${name}` }))
}

it('moves the contents of a place, with slots, tools, and a warning when full', async () => {
  const { a, b } = await seed()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  const user = userEvent.setup()
  render(<App />)
  const place = await openPlace(user, 'B-01', 'Old box')
  expect(place.getByLabelText('Tools and supplies here')).toHaveTextContent('Clippers')
  await user.click(place.getByRole('button', { name: '📦 Move contents…' }))
  const d = within(await screen.findByRole('dialog', { name: 'Move from Old box' }))
  await user.selectOptions(d.getByLabelText('Move to'), 'new')
  expect(d.getByRole('status')).toHaveTextContent('1 will have no slot')
  expect(d.getByText(/→ slot 1/)).toBeInTheDocument()
  await user.click(d.getByRole('button', { name: '📦 Move 3 to New box' }))
  expect(confirm).toHaveBeenCalled()
  await waitFor(() => expect(useStore.getState().storage.homes).toMatchObject({ [a.id]: { placeId: 'new', slot: 1 }, [b.id]: { placeId: 'new' } }))
  expect(useStore.getState().storage.homes[b.id].slot).toBeUndefined()
  expect(useStore.getState().tools[0].placeId).toBe('new')
})

it('takes units for now, and moves a whole place', async () => {
  const { a } = await seed()
  const user = userEvent.setup()
  render(<App />)
  const place = await openPlace(user, 'B-01', 'Old box')
  await user.click(place.getByRole('button', { name: '📦 Move contents…' }))
  const d = within(await screen.findByRole('dialog', { name: 'Move from Old box' }))
  await user.click(d.getByRole('button', { name: 'None' }))
  await user.click(d.getByLabelText(/^Alpha/))
  await user.click(d.getByLabelText('Take for now (check out)'))
  await user.selectOptions(d.getByLabelText('Move to'), 'shelf')
  await user.click(d.getByRole('button', { name: '📦 Move 1 to Shelf' }))
  await waitFor(() => expect(useStore.getState().storage.out).toEqual({ [a.id]: 'shelf' }))
  expect(useStore.getState().storage.homes[a.id].placeId).toBe('old')

  await user.click(place.getByRole('button', { name: '↦ Move this place' }))
  const m = within(await screen.findByRole('dialog', { name: 'Move Old box' }))
  await user.selectOptions(m.getByLabelText('Put it in'), 'shelf')
  await user.click(m.getByRole('button', { name: 'Move' }))
  await waitFor(() => expect(placeById(useStore.getState().storage, 'old')!.parentId).toBe('shelf'))
})

it('stores the units shown on the Backlog, and scans stickers into a place', async () => {
  const { a, b, z } = await seed()
  const user = userEvent.setup()
  render(<App />)
  await user.selectOptions(await screen.findByLabelText('Faction'), 'Orks')
  await user.click(screen.getByRole('button', { name: '📦 Store shown units… (2)' }))
  const d = within(await screen.findByRole('dialog', { name: 'Store the shown units' }))
  await user.selectOptions(d.getByLabelText('Move to'), 'shelf')
  await user.click(d.getByRole('button', { name: '📦 Move 2 to Shelf' }))
  await waitFor(() => expect(useStore.getState().storage.homes[a.id].placeId).toBe('shelf'))
  expect(useStore.getState().storage.homes[b.id].placeId).toBe('shelf')

  const place = await openPlace(user, 'B-02', 'New box')
  await user.click(place.getByRole('button', { name: '📷 Scan into here' }))
  const scan = within(await screen.findByRole('dialog', { name: 'Scan into New box' }))
  await user.type(await screen.findByLabelText('Type a code or barcode'), 'U-003{enter}')
  await waitFor(() => expect(useStore.getState().storage.homes[z.id]).toEqual({ placeId: 'new', slot: 1 }))
  expect(scan.getByLabelText('Moved')).toHaveTextContent('✓ Zeta → slot 1')
  await user.type(await screen.findByLabelText('Type a code or barcode'), 'B-01{enter}')
  await waitFor(() => expect(placeById(useStore.getState().storage, 'old')!.parentId).toBe('new'))
  await user.type(await screen.findByLabelText('Type a code or barcode'), 'Q-9{enter}')
  expect(await scan.findByText(/Q-9: no unit or place/)).toBeInTheDocument()
})
