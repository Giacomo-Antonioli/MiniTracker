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
  await user.click(await screen.findByRole('tab', { name: '📦 Storage' }))
  const st = within(await screen.findByRole('region', { name: 'Storage' }))
  await user.selectOptions(st.getByLabelText('Storage status'), 'lent')
  await waitFor(() => expect(Object.values(useStore.getState().storage.flow)).toEqual(['lent']))
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
  useStore.setState({ units: [a, b], storage: { ...EMPTY_STORAGE, places: [
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

it('separate storages with tabs, place page, editable kinds', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Storage' }))
  await user.click(screen.getByRole('button', { name: '+ Add storage' }))
  await user.click(within(screen.getByRole('form', { name: 'Add storage' })).getByRole('button', { name: 'Save' }))
  expect(screen.getByRole('alert').textContent).toMatch(/name/)
  await user.type(screen.getByLabelText('Storage name'), 'Home')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await user.click(await screen.findByRole('button', { name: '+ Add storage' }))
  await user.type(screen.getByLabelText('Storage name'), 'Club')
  await user.type(screen.getByLabelText('Address'), 'Via Roma 1')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('tab', { name: '🏠 Club', selected: true })).toBeTruthy()
  expect(screen.getByText('Via Roma 1')).toBeTruthy()
  await addPlace(user, 'drawer', 'Drawer 1')
  await addPlace(user, 'box', 'Box C', 'Drawer 1')
  await user.click(screen.getByRole('tab', { name: '🏠 Home' }))
  expect(screen.queryByRole('button', { name: /Drawer 1/ })).toBeNull()
  await user.click(screen.getByRole('tab', { name: '🏠 Club' }))
  // place page via double-click, then to the child and back up
  await user.dblClick(screen.getByRole('button', { name: /Drawer 1/ }))
  const page = within(await screen.findByRole('region', { name: 'Place Drawer 1' }))
  expect(page.getByText('Club')).toBeTruthy()
  expect(page.getByText('No moves yet.')).toBeTruthy()
  await user.click(page.getByRole('button', { name: /Box C/ }))
  await user.click(await screen.findByRole('button', { name: '← Back to Drawer 1' }))
  await user.click(await screen.findByRole('button', { name: 'Edit' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await user.click(screen.getByRole('button', { name: '← Back to Storage' }))
  // edit and delete a storage
  await user.click(await screen.findByRole('button', { name: 'Edit storage' }))
  await user.clear(screen.getByLabelText('Storage name'))
  await user.type(screen.getByLabelText('Storage name'), 'Club 2')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await user.click(await screen.findByRole('button', { name: 'Delete storage' }))
  await waitFor(() => expect(useStore.getState().storage.sites.map((x) => x.name)).toEqual(['Home']))
  expect(useStore.getState().storage.places.every((p) => !p.siteId || p.siteId === useStore.getState().storage.sites[0].id)).toBe(true)

  // Settings: kinds
  await user.click(screen.getByRole('button', { name: /Settings/ }))
  await user.click(await screen.findByRole('tab', { name: 'Pipelines' }))
  const kinds = within(await screen.findByRole('group', { name: 'Place kinds' }))
  expect((kinds.getByRole('button', { name: 'Delete Drawer' }) as HTMLButtonElement).disabled).toBe(true)
  await user.click(kinds.getByRole('button', { name: '+ Add kind' }))
  const names = kinds.getAllByLabelText(/^Name of/)
  await user.clear(names[names.length - 1])
  await user.type(names[names.length - 1], 'Magnetic tray')
  await user.click(kinds.getByRole('button', { name: 'Move Magnetic tray up' }))
  await user.click(kinds.getByRole('button', { name: 'Move Magnetic tray down' }))
  await user.click(kinds.getByRole('button', { name: 'Delete Tray' }))
  await user.clear(kinds.getByLabelText('Icon of Shelf'))
  await user.click(kinds.getByRole('button', { name: 'Save kinds' }))
  await waitFor(() => expect(useStore.getState().storage.kinds.at(-1)?.name).toBe('Magnetic tray'))
  await user.clear(kinds.getByLabelText('Name of Shelf'))
  await user.click(kinds.getByRole('button', { name: 'Save kinds' }))
  expect(kinds.getByRole('alert').textContent).toMatch(/name/)
})
