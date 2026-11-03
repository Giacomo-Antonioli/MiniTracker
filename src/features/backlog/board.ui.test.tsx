// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { createUnit } from '../../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  try { localStorage.removeItem('backlogView') } catch { /* ignore */ }
  let n = 0
  const unit = createUnit({ customName: 'Squad', factionName: 'Ultramarines', groups: [{ count: 4, status: 'painted' }, { count: 6, status: 'built' }] }, { now: new Date().toISOString(), newId: () => `id${++n}` })
  await appDb.units.put(unit)
  useStore.setState({ ready: false, units: [], events: {}, pipeline: DEFAULT_PIPELINE, catalogue: null })
})

const stageOf = (name: string) => screen.getByRole('region', { name: `Stage ${name}` })
const stageName = (id: string) => DEFAULT_PIPELINE.stages.find((s) => s.id === id)!.name

it('shows a board with a card per stage group and moves models from the card menu', async () => {
  const user = userEvent.setup()
  render(<App />)
  await waitFor(() => expect(useStore.getState().ready).toBe(true))
  await user.click(await screen.findByRole('tab', { name: '▦ Board' }))
  expect(within(stageOf(stageName('built'))).getByRole('article', { name: /Squad, 6 in/ })).toBeTruthy()
  expect(within(stageOf(stageName('painted'))).getByRole('article', { name: /Squad, 4 in/ })).toBeTruthy()

  const card = within(stageOf(stageName('built'))).getByRole('article', { name: /Squad, 6 in/ })
  await user.selectOptions(within(card).getByLabelText('Move Squad to'), 'primed')
  const dialog = screen.getByRole('dialog', { name: 'Move models' })
  const count = within(dialog).getByRole('spinbutton')
  await user.clear(count)
  await user.type(count, '2')
  await user.click(within(dialog).getByRole('button', { name: /Move/ }))
  await waitFor(() => expect(within(stageOf(stageName('primed'))).getByRole('article', { name: /Squad, 2 in/ })).toBeTruthy())
  expect(within(stageOf(stageName('built'))).getByRole('article', { name: /Squad, 4 in/ })).toBeTruthy()
})

it('opens the move dialog when a card is dropped on another stage, and remembers the view', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<App />)
  await waitFor(() => expect(useStore.getState().ready).toBe(true))
  await user.click(await screen.findByRole('tab', { name: '▦ Board' }))
  const card = within(stageOf(stageName('built'))).getByRole('article', { name: /Squad, 6 in/ })
  const data = new Map<string, string>()
  const dataTransfer = { setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? '', get types() { return [...data.keys()] } }
  fireEvent.dragStart(card, { dataTransfer })
  fireEvent.dragOver(stageOf(stageName('painted')), { dataTransfer })
  fireEvent.drop(stageOf(stageName('painted')), { dataTransfer })
  const dialog = screen.getByRole('dialog', { name: 'Move models' })
  expect((within(dialog).getByLabelText('To stage') as HTMLSelectElement).value).toBe('painted')
  unmount()
  render(<App />)
  expect(await screen.findByRole('tab', { name: '▦ Board', selected: true })).toBeTruthy()
})
