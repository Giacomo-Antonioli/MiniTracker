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
import { EMPTY_STORAGE } from '../../domain/storage/storage'
import { PickListDialog } from './Storage'

beforeEach(async () => {
  localStorage.setItem('startPage', 'backlog')
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], events: {}, homeLayout: DEFAULT_LAYOUT, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES, catalogue: null, shopItems: [], shopLists: [], storage: EMPTY_STORAGE, companion: null })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  window.print = vi.fn()
})

async function addPlace(user: ReturnType<typeof userEvent.setup>, kind: string, name: string, inside?: string, slots?: string) {
  await user.click(screen.getByRole('button', { name: '+ Add place' }))
  const f = within(screen.getByRole('form', { name: 'Add place' }))
  await user.selectOptions(f.getByLabelText('Kind'), kind)
  await user.type(f.getByLabelText('Name'), name)
  if (inside) await user.selectOptions(f.getByLabelText('Inside'), within(f.getByLabelText('Inside')).getByRole('option', { name: new RegExp(inside) }))
  if (slots) await user.type(f.getByLabelText('Slots'), slots)
  await user.click(f.getByRole('button', { name: 'Save' }))
}

it('places tree, unit home with slot, check out and put back', async () => {
  const c = ctx()
  const a = createUnit({ customName: 'Alpha', groups: [{ count: 5, status: 'built' }] }, c)
  await appDb.units.put(a)
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Storage' }))
  expect(screen.getByText(/Add your shelves/)).toBeTruthy()
  // validation
  await user.click(screen.getByRole('button', { name: '+ Add place' }))
  await user.click(within(screen.getByRole('form', { name: 'Add place' })).getByRole('button', { name: 'Save' }))
  expect(screen.getByRole('alert').textContent).toMatch(/name/)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await addPlace(user, 'shelf', 'Shelf 2')
  await addPlace(user, 'box', 'Box A', 'Shelf 2', '4')
  await addPlace(user, 'case', 'Travel case')
  const detail = within(await screen.findByRole('region', { name: 'Place Travel case' }))
  expect(detail.getByText(/Nothing stored here/)).toBeTruthy()

  // Unit page: home + slot, check out, put back
  await user.click(screen.getByRole('button', { name: 'Backlog' }))
  await user.dblClick(await screen.findByRole('cell', { name: 'Alpha' }))
  const st = within(await screen.findByRole('region', { name: 'Storage' }))
  await user.selectOptions(st.getByLabelText('Home place'), within(st.getByLabelText('Home place')).getByRole('option', { name: /Box A/ }))
  await waitFor(() => expect(st.getByText('Shelf 2 › Box A · slot 1')).toBeTruthy())
  await user.selectOptions(st.getByLabelText('Slot'), '3')
  await waitFor(() => expect(st.getByText('Shelf 2 › Box A · slot 3')).toBeTruthy())
  await user.selectOptions(st.getByLabelText('Check out to'), within(st.getByLabelText('Check out to')).getByRole('option', { name: /Travel case/ }))
  await user.click(st.getByRole('button', { name: 'Check out' }))
  expect(await st.findByText('(checked out)')).toBeTruthy()
  expect(st.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2)

  // Storage page shows it in the case, put everything back
  await user.click(screen.getByRole('button', { name: 'Storage' }))
  await user.click(screen.getByRole('button', { name: /Travel case/ }))
  const tc = within(await screen.findByRole('region', { name: 'Place Travel case' }))
  expect(tc.getByText('1. Shelf 2 › Box A')).toBeTruthy()
  await user.click(tc.getByRole('button', { name: '↩ Put everything back' }))
  await waitFor(() => expect(useStore.getState().storage.out).toEqual({}))
  await user.click(screen.getByRole('button', { name: /Box A/ }))
  const box = within(await screen.findByRole('region', { name: 'Place Box A' }))
  expect(within(box.getByRole('list', { name: 'Units stored here' })).getByText('Alpha')).toBeTruthy()
  // edit, then delete: the unit loses its home
  await user.click(box.getByRole('button', { name: 'Edit' }))
  const ed = within(screen.getByRole('form', { name: 'Edit place' }))
  await user.clear(ed.getByLabelText('Location'))
  await user.type(ed.getByLabelText('Location'), 'study')
  await user.click(ed.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('📍 study')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(useStore.getState().storage.homes).toEqual({}))
})

it('pick list: places in order, unstored, pack into a case and put back', async () => {
  const c = ctx()
  const a = createUnit({ customName: 'Alpha', groups: [{ count: 5, status: 'built' }] }, c)
  const b = createUnit({ customName: 'Bravo', groups: [{ count: 5, status: 'built' }] }, c)
  useStore.setState({ units: [a, b], storage: { places: [
    { id: 'box', name: 'Box A', kind: 'box', location: '', note: '', createdAt: '', capacity: 4 },
    { id: 'case', name: 'Case', kind: 'case', location: '', note: '', createdAt: '' },
  ], homes: { [a.id]: { placeId: 'box', slot: 2 } }, out: {}, log: [] } })
  const user = userEvent.setup()
  render(<PickListDialog title="Army" unitIds={[a.id, b.id]} unlinked={1} onClose={() => {}} />)
  expect(screen.getByText('1. Box A')).toBeTruthy()
  expect(screen.getByText(/Not stored anywhere: Bravo/)).toBeTruthy()
  expect(screen.getByText(/1 list entry is not linked/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '🧳 Pack 1 into Case' }))
  expect(await screen.findByText(/Already in Case: Alpha/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '🖨 Print' }))
  await user.click(screen.getByRole('button', { name: '↩ Put back 1' }))
  await waitFor(() => expect(useStore.getState().storage.out).toEqual({}))
  await user.selectOptions(screen.getByLabelText('Pack into'), '')
  expect(screen.queryByRole('button', { name: /Pack/ })).toBeNull()
})
