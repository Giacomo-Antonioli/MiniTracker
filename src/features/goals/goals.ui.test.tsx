// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { createUnit } from '../../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], events: {}, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES, goals: [] })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

it('creates, edits and deletes goals of each kind', async () => {
  const now = new Date().toISOString()
  let n = 0
  const unit = createUnit({ customName: 'Squad', groups: [{ count: 4, status: 'painted' }, { count: 6, status: 'built' }] }, { now, newId: () => `id${++n}` })
  await appDb.units.put(unit)
  await appDb.statusEvents.put({ id: 'e1', unitId: unit.id, groupId: unit.groups[0].id, from: 'built', to: 'painted', count: 4, date: now, direction: 'forward', note: '' })
  const user = userEvent.setup()
  render(<App />)
  await waitFor(() => expect(useStore.getState().ready).toBe(true))
  await user.click(screen.getByRole('button', { name: 'Goals' }))
  expect(screen.getByText(/No goals yet/)).toBeTruthy()

  await user.click(screen.getByRole('button', { name: '+ Goal' }))
  let form = within(screen.getByRole('form', { name: 'Goal' }))
  await user.click(form.getByRole('button', { name: 'Save goal' }))
  const list = within(screen.getByRole('list', { name: 'Goals' }))
  expect(await list.findByText('4 / 10 models')).toBeTruthy()

  await user.click(await screen.findByRole('button', { name: '+ Goal' }))
  form = within(screen.getByRole('form', { name: 'Goal' }))
  await user.selectOptions(form.getByLabelText('Kind'), 'units')
  await user.click(form.getByRole('button', { name: 'Save goal' }))
  expect(form.getByRole('alert')).toHaveTextContent('Pick at least one unit')
  await user.type(form.getByLabelText('Filter units'), 'squ')
  await user.click(form.getByLabelText('Squad'))
  await user.type(form.getByLabelText('Due (optional)'), '2000-01-01')
  await user.click(form.getByRole('button', { name: 'Save goal' }))
  expect(await list.findByText('Finish 1 unit by 2000-01-01')).toBeTruthy()
  expect(list.getByText(/overdue/)).toBeTruthy()

  for (const [kind, text] of [['pile', /painted, \d+ added/], ['streak', '1 / 4 weeks']] as const) {
    await user.click(await screen.findByRole('button', { name: '+ Goal' }))
    form = within(screen.getByRole('form', { name: 'Goal' }))
    await user.selectOptions(form.getByLabelText('Kind'), kind)
    await user.click(form.getByRole('button', { name: 'Save goal' }))
    expect(await list.findByText(text)).toBeTruthy()
  }

  await user.click(list.getByRole('button', { name: 'Edit Paint 10 models a month' }))
  form = within(screen.getByRole('form', { name: 'Goal' }))
  await user.type(form.getByLabelText('Title (optional)'), 'Monthly')
  await user.selectOptions(form.getByLabelText('Every'), 'year')
  await user.click(form.getByRole('button', { name: 'Save goal' }))
  expect(await list.findByText('Monthly')).toBeTruthy()
  await user.click(list.getByRole('button', { name: 'Delete Monthly' }))
  expect(list.queryByText('Monthly')).toBeNull()
  expect(useStore.getState().goals).toHaveLength(3)

  await user.click(screen.getByRole('button', { name: 'Home' }))
  const card = within(await screen.findByRole('list', { name: 'Goal progress' }))
  expect(card.getAllByRole('listitem')).toHaveLength(3)
  await user.click(screen.getByRole('button', { name: 'Goals →' }))
  expect(await screen.findByRole('heading', { name: 'Goals', level: 1 })).toBeTruthy()
})
