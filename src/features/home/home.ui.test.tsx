// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { createUnit } from '../../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'
import { ago } from './HomePage'

beforeEach(async () => {
  localStorage.setItem('startPage', 'home')
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], events: {}, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES, catalogue: null, shopItems: [], shopLists: [] })
})

describe('Home', () => {
  it('welcomes a new user and leads to the backlog', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '+ Add your first unit' }))
    expect(await screen.findByText(/Your backlog is empty/)).toBeTruthy()
  })

  it('shows tiles, the units to continue, recent moves and shopping; moves from the card', async () => {
    const now = new Date().toISOString()
    let n = 0
    const squad = createUnit({ customName: 'Squad', factionName: 'Testers', groups: [{ count: 4, status: 'painted' }, { count: 6, status: 'built' }] }, { now, newId: () => `id${++n}` })
    await appDb.units.put(squad)
    await appDb.statusEvents.put({ id: 'e1', unitId: squad.id, groupId: squad.groups[0].id, from: 'built', to: 'painted', count: 4, date: now, direction: 'forward', note: '' })
    await appDb.shopItems.put({ id: 's1', kind: 'other', name: 'Glue', qty: 1, price: 4.5, bought: false, sources: [], listIds: ['main'], createdAt: now, updatedAt: now } as never)
    const user = userEvent.setup()
    render(<App />)

    const tiles = within(await screen.findByRole('region', { name: 'Summary' }))
    await waitFor(() => expect(tiles.getByText('Painted this month').nextSibling?.textContent).toBe('4'))
    expect(tiles.getByText('Molehill')).toBeTruthy()
    const recent = within(screen.getByRole('region', { name: 'Recent activity' }))
    expect(recent.getByText('4 × Squad → Painted')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Closest to done' })).getByText('Testers')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Shopping' })).getByText('€4.50')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Models painted in the last 6 months' })).toBeTruthy()

    const cont = within(screen.getByRole('region', { name: 'Continue painting' }))
    await user.click(cont.getByRole('button', { name: 'All' }))
    expect(await recent.findByText('6 × Squad → Primed')).toBeTruthy()

  })

  it('says how long ago', () => {
    expect([ago('2026-03-10', '2026-03-10T12:00:00Z'), ago('2026-03-09', '2026-03-10'), ago('2025-12-10', '2026-03-10')]).toEqual(['today', 'yesterday', '3 months ago'])
  })

  it('remembers the start page chosen in settings', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '⚙ Settings' }))
    await user.selectOptions(screen.getByLabelText('Start page'), 'backlog')
    expect(localStorage.getItem('startPage')).toBe('backlog')
  })
})
