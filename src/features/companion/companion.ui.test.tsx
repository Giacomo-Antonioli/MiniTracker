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
import { addSection, addStep, createScheme } from '../../domain/schemes/scheme'
import { newSupply } from '../../domain/supplies/supplies'

beforeEach(async () => {
  localStorage.setItem('startPage', 'backlog')
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], events: {}, homeLayout: DEFAULT_LAYOUT, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES, catalogue: null, shopItems: [], shopLists: [], paintSessions: [], paintTimers: [], companion: null, companionTicks: {}, supplies: [] })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

async function seed() {
  const c = ctx()
  let s = createScheme({ name: 'Sept white', stage: 'final' }, c)
  s = addSection(s, 'Armour', c)
  s = addStep(s, s.sections[0].id, { technique: 'Drybrush', paints: [], note: 'light' }, c)
  await appDb.schemes.put(s)
  const u = createUnit({ customName: 'Alpha', factionName: 'Testers', groups: [{ count: 5, status: 'built' }] }, c)
  const unit = { ...u, schemeId: s.id, tutorials: [{ url: 'https://example.com/b', title: 'Build guide', kind: 'build' as const }], groups: [{ ...u.groups[0], loadout: ['Bolter'], magnetised: [{ slot: 'Arm', optionIds: ['a', 'b'] }] }] }
  const other = createUnit({ customName: 'Bravo', groups: [{ count: 2, status: 'built' }] }, c)
  await appDb.units.bulkPut([unit, other])
  await appDb.settings.put({ key: 'supplies', value: [newSupply({ name: 'Glue', category: 'Glue', quantity: 2, lowAt: 0 }, c)] } as never)
  return { unit, other }
}

it('painter companion: scheme checklist with tips, timers with switching, notes, move stops the timer', async () => {
  const { other } = await seed()
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Paint Alpha' }))
  const page = within(await screen.findByLabelText('🎨 Painter companion'))
  const steps = within(page.getByRole('region', { name: 'Scheme steps' }))
  expect(steps.getByText(/Sept white/)).toBeTruthy()
  expect(steps.getByText(/💡/)).toBeTruthy()
  await user.click(steps.getByRole('checkbox'))
  expect(steps.getByText('1 / 1 done')).toBeTruthy()
  await waitFor(async () => expect(await appDb.settings.get('companionTicks')).toBeTruthy())
  await user.click(steps.getByRole('button', { name: 'Reset' }))
  expect(steps.getByText('0 / 1 done')).toBeTruthy()

  // A paused timer on another unit; starting here pauses running ones, and we can switch back.
  await useStore.getState().saveTimer({ id: 'o', targets: [{ unitId: other.id, groupId: other.groups[0].id, count: 2 }], note: '', elapsedMs: 0, runningSince: new Date().toISOString(), createdAt: '' })
  const timers = within(page.getByRole('region', { name: 'Timers' }))
  await user.click(timers.getByRole('button', { name: '▶ Start timer' }))
  await waitFor(() => expect(useStore.getState().paintTimers.find((t) => t.id === 'o')?.runningSince).toBeUndefined())
  await user.click(timers.getByRole('button', { name: 'Switch to this' }))
  await waitFor(() => expect(useStore.getState().companion?.unitId).toBe(other.id))
  expect(useStore.getState().paintTimers.filter((t) => t.runningSince).map((t) => t.id)).toEqual(['o'])
  await user.click(screen.getByRole('button', { name: 'Switch to this' }))
  await waitFor(() => expect(useStore.getState().companion?.unitId).not.toBe(other.id))

  // Notes
  const notes = within(screen.getByRole('region', { name: 'Photo and notes' }))
  await user.type(notes.getByLabelText('Unit notes'), 'thin coats')
  await user.click(notes.getByRole('button', { name: 'Save notes' }))
  expect(await notes.findByText('Notes saved.')).toBeTruthy()

  // Done → next stage stops the running timer of this unit and logs it.
  await user.click(screen.getByRole('button', { name: /Done → / }))
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Move/ }))
  await waitFor(() => expect(useStore.getState().paintTimers.map((t) => t.id)).toEqual(['o']))

  await user.click(screen.getByRole('button', { name: 'Switch to 🔨 Builder' }))
  expect(await screen.findByLabelText('🔨 Builder companion')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '← Back' }))
  expect(useStore.getState().companion).toBeNull()
})

it('builder companion: loadout and magnets checklist, build links, supplies; opened from a timer and the unit page', async () => {
  const { unit } = await seed()
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Build Alpha' }))
  const page = within(await screen.findByLabelText('🔨 Builder companion'))
  const list = within(page.getByRole('region', { name: 'Build checklist' }))
  expect(list.getByText('Bolter')).toBeTruthy()
  expect(list.getByText('🧲 Arm')).toBeTruthy()
  for (const b of list.getAllByRole('checkbox')) await user.click(b)
  expect(list.getByText('2 / 2 done')).toBeTruthy()
  await user.click(list.getByRole('button', { name: 'Reset' }))
  await waitFor(() => expect(useStore.getState().companionTicks).toEqual({}))
  expect(page.getByRole('link', { name: 'Build guide' })).toBeTruthy()
  const sup = within(page.getByRole('region', { name: 'Supplies used' }))
  await user.click(sup.getByRole('button', { name: 'Used one' }))
  expect(await sup.findByText(/1 left/)).toBeTruthy()
  // Start a timer, go Home and reopen from it.
  await user.click(page.getByRole('button', { name: '▶ Start timer' }))
  await waitFor(() => expect(useStore.getState().paintTimers[0]?.stage).toBe('built'))
  useStore.getState().closeCompanion()
  useStore.setState({ companion: null })
  await user.click(screen.getAllByRole('button', { name: /Home/ })[0])
  await user.click(await screen.findByRole('button', { name: 'Open painter companion' }))
  expect(await screen.findByLabelText('🎨 Painter companion')).toBeTruthy()
  // Deleted unit
  await useStore.getState().deleteUnit(unit.id)
  expect(await screen.findByText('This unit no longer exists.')).toBeTruthy()
})
