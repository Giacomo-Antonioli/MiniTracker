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
import { EMPTY_STORAGE, setHome, savePlace } from '../../domain/storage/storage'
import { labelsHtml, stencilSvg } from './Labels'

beforeEach(async () => {
  localStorage.setItem('startPage', 'backlog')
  history.replaceState(null, '', '/')
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], events: {}, homeLayout: DEFAULT_LAYOUT, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES, catalogue: null, shopItems: [], shopLists: [], storage: EMPTY_STORAGE, companion: null })
})

async function seed() {
  const c = ctx()
  const a = createUnit({ customName: 'Alpha', groups: [{ count: 5, status: 'built' }] }, c)
  await appDb.units.put(a)
  let s = savePlace(EMPTY_STORAGE, { id: 'box', name: 'Box A', kind: 'box', location: 'study', note: '', createdAt: '' })
  s = setHome(s, a.id, { placeId: 'box', slot: 2 }, c)
  await appDb.settings.put({ key: 'storage', value: s } as never)
  return a
}

it('label HTML and stencil SVG', () => {
  const items = [{ code: 'U-001', name: 'Alpha', sub: '', contents: [], qr: '<svg></svg>' }, { code: 'B-01', name: 'Box <A>', sub: 'Shelf', contents: Array.from({ length: 14 }, (_, i) => `u${i}`), qr: '<svg></svg>' }]
  expect(labelsHtml(items, 'stickers', 15)).toMatch(/width:15mm/)
  const boxes = labelsHtml(items, 'boxes', 15)
  expect(boxes).toMatch(/Box &lt;A&gt;/)
  expect(boxes).toMatch(/\+2 more/)
  expect(labelsHtml(items, 'stencil', 8)).toMatch(/<path d="M/)
  expect(stencilSvg(['U-001'], 8)).toMatch(/^<svg/)
})

it('labels dialog assigns codes and prints; find code opens the unit; code badge; scan without camera', async () => {
  const a = await seed()
  const win = { document: { write: vi.fn(), close: vi.fn() } }
  const open = vi.spyOn(window, 'open').mockReturnValueOnce(null).mockReturnValue(win as never)
  URL.createObjectURL = vi.fn(() => 'blob:x')
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Storage' }))
  await user.click(screen.getByRole('button', { name: '🏷 Labels' }))
  const d = within(await screen.findByRole('dialog', { name: 'Labels and stencils' }))
  await user.click(d.getByRole('button', { name: '🖨 Print' }))
  expect(await d.findByText(/Allow pop-ups/)).toBeTruthy()
  await user.click(d.getByRole('button', { name: '🖨 Print' }))
  await waitFor(() => expect(win.document.write).toHaveBeenCalled())
  expect(win.document.write.mock.calls[0][0]).toMatch(/U-001-1/)
  expect(win.document.write.mock.calls[0][0]).toMatch(/U-001-5/)
  expect(win.document.write.mock.calls[0][0]).not.toMatch(/U-001-6/)
  expect(useStore.getState().storage.codes).toEqual({ [a.id]: 'U-001', box: 'B-01' })
  await user.click(d.getByRole('button', { name: '📦 Box labels' }))
  await user.click(d.getByLabelText(/Box A/))
  await user.click(d.getByLabelText(/Box A/))
  await user.click(d.getByRole('button', { name: '🖨 Print' }))
  await waitFor(() => expect(win.document.write.mock.calls.at(-1)![0]).toMatch(/2\. Alpha/))
  await user.click(d.getByRole('button', { name: '✂ Stencil sheet' }))
  await user.selectOptions(d.getByLabelText('Size'), '20')
  await user.click(d.getByLabelText(/^Alpha/))
  await user.click(d.getByLabelText(/^Alpha/))
  await user.click(d.getByRole('button', { name: '⬇ Download SVG' }))
  expect(await d.findByText('Stencil SVG downloaded.')).toBeTruthy()
  await user.click(d.getByRole('button', { name: 'Close' }))
  expect(open).toHaveBeenCalled()

  // Find code
  await user.type(screen.getByLabelText('Find code'), 'z9{enter}')
  expect(screen.getByRole('alert').textContent).toMatch(/Z-9/)
  await user.clear(screen.getByLabelText('Find code'))
  await user.type(screen.getByLabelText('Find code'), 'b01{enter}')
  expect(await screen.findByRole('region', { name: 'Place Box A' })).toBeTruthy()
  expect(within(screen.getByLabelText('Code')).getByText('B-01')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '← Back to Storage' }))
  await user.type(await screen.findByLabelText('Find code'), 'U-001{enter}')
  await user.click(await screen.findByRole('tab', { name: '📦 Storage' }))
  expect(within(screen.getByLabelText('Code')).getByText('U-001')).toBeTruthy()
  expect(within(screen.getByLabelText('Model codes')).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['U-001-1', 'U-001-2', 'U-001-3', 'U-001-4', 'U-001-5'])

  // Scan: jsdom has no camera
  await user.click(screen.getByRole('button', { name: 'Storage' }))
  await user.click(screen.getByRole('button', { name: '📷 Scan' }))
  expect(await screen.findByText(/cannot use the camera/)).toBeTruthy()
})

it('a unit without code can get one; #code link opens the item or says it is missing', async () => {
  const a = await seed()
  const user = userEvent.setup()
  render(<App />)
  await user.dblClick(await screen.findByRole('cell', { name: 'Alpha' }))
  await user.click(await screen.findByRole('tab', { name: '📦 Storage' }))
  await user.click(screen.getByRole('button', { name: '🏷 Give it a code' }))
  expect(await screen.findByText('U-001')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Storage' }))
  location.hash = '#code=Q-404'
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  expect(await screen.findByText(/No unit or place with code Q-404/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Dismiss' }))
  location.hash = '#code=U-001'
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  expect(await screen.findByRole('heading', { name: a.customName })).toBeTruthy()
})
