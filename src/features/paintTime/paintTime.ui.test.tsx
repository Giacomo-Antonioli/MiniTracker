// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { createUnit } from '../../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'
import { DEFAULT_LAYOUT } from '../../domain/home/layout'

beforeEach(async () => {
  localStorage.setItem('startPage', 'home')
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], events: {}, homeLayout: DEFAULT_LAYOUT, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES, catalogue: null, shopItems: [], shopLists: [], paintSessions: [], paintTimers: [] })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

async function seed() {
  const now = new Date().toISOString()
  let n = 0
  const c = { now, newId: () => `id${++n}` }
  const a = createUnit({ customName: 'Alpha', factionName: 'Testers', groups: [{ count: 10, status: 'built' }] }, c)
  const b = createUnit({ customName: 'Bravo', factionName: 'Others', groups: [{ count: 5, status: 'built' }] }, c)
  await appDb.units.bulkPut([a, b])
  return { a, b }
}

it('batch timer: start on two groups, pause, resume, stop splits by minis; Stats shows totals and edits sessions', async () => {
  const { a } = await seed()
  const user = userEvent.setup()
  render(<App />)
  const card = within(await screen.findByRole('region', { name: 'Painting timer' }))
  await user.click(card.getByRole('button', { name: '▶ Start timer' }))
  const form = within(card.getByRole('form', { name: 'Start timer' }))
  await user.click(form.getByLabelText(/Alpha/))
  await user.click(form.getByLabelText(/Bravo/))
  expect(form.getByText(/split by the number of minis/)).toBeTruthy()
  await user.selectOptions(form.getByLabelText('Timer stage'), 'built')
  await user.click(form.getByRole('button', { name: '▶ Start' }))

  await user.click(await card.findByRole('button', { name: '⏸ Pause' }))
  expect(card.getByText(/15 minis/)).toBeTruthy()
  // Pretend an hour was painted before the pause; the paused timer is saved.
  const t = useStore.getState().paintTimers[0]
  await useStore.getState().saveTimer({ ...t, elapsedMs: 60 * 60000 })
  expect(await card.findByText('1:00:00 ⏸')).toBeTruthy()
  expect(await appDb.settings.get('paintTimers')).toBeTruthy()
  await user.click(card.getByRole('button', { name: '▶ Resume' }))
  await user.click(card.getByRole('button', { name: '■ Stop' }))
  await waitFor(() => expect(useStore.getState().paintSessions.map((s) => [s.unitId === a.id, s.minutes])).toEqual([[true, 40], [false, 20]]))
  await waitFor(() => expect(useStore.getState().paintTimers).toEqual([]))
  expect(await card.findByText('This week: 1 h 00 min')).toBeTruthy()

  // Stats
  await user.click(screen.getAllByRole('button', { name: /Stats/ })[0])
  const sec = within(await screen.findByRole('region', { name: 'Painting time' }))
  expect(sec.getByText(/1 h 00 min in this range/)).toBeTruthy()
  expect(within(sec.getByRole('table', { name: 'Painting sessions' })).getAllByRole('row')).toHaveLength(3)

  // Add one by hand, with a validation error first.
  await user.click(sec.getByRole('button', { name: '+ Add session' }))
  const add = within(sec.getByRole('form', { name: 'Add session' }))
  await user.click(add.getByRole('button', { name: 'Save' }))
  expect(add.getByRole('alert').textContent).toMatch(/group/)
  await user.selectOptions(add.getByLabelText('Model group'), `${a.id}/${a.groups[0].id}`)
  await user.clear(add.getByLabelText('Minutes'))
  await user.type(add.getByLabelText('Minutes'), '30')
  await user.click(add.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(sec.getByText(/1 h 30 min in this range/)).toBeTruthy())

  // Edit, then delete.
  await user.click(sec.getAllByRole('button', { name: 'Edit session' })[0])
  const edit = within(sec.getByRole('form', { name: 'Edit session' }))
  await user.clear(edit.getByLabelText('Minutes'))
  await user.type(edit.getByLabelText('Minutes'), '90')
  await user.click(edit.getByRole('button', { name: 'Save' }))
  await user.click(sec.getAllByRole('button', { name: 'Delete session' })[0])
  await waitFor(() => expect(useStore.getState().paintSessions).toHaveLength(2))

  // Faction filter
  await user.selectOptions(screen.getByLabelText('Faction'), 'Others')
  expect(within(screen.getByRole('table', { name: 'Painting sessions' })).getAllByRole('row').length).toBeLessThan(3)
})

it('discard a timer without logging time', async () => {
  await seed()
  const user = userEvent.setup()
  render(<App />)
  const card = within(await screen.findByRole('region', { name: 'Painting timer' }))
  await user.click(card.getByRole('button', { name: '▶ Start timer' }))
  await user.type(card.getByLabelText('Search units'), 'brav')
  expect(card.queryByLabelText(/Alpha/)).toBeNull()
  await user.click(card.getByLabelText(/Bravo/))
  await user.click(card.getByRole('button', { name: '▶ Start' }))
  await user.click(await card.findByRole('button', { name: 'Discard timer' }))
  await waitFor(() => expect(useStore.getState().paintTimers).toEqual([]))
  expect(useStore.getState().paintSessions).toEqual([])
  await user.type(card.getByRole('button', { name: '▶ Start timer' }), '{enter}')
  await user.type(card.getByLabelText('Search units'), 'zzz')
  expect(card.getByText('No units found')).toBeTruthy()
  await user.click(card.getByRole('button', { name: 'Cancel' }))
})
