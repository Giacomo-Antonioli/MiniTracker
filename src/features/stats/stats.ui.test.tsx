// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { parseBsData } from '../../data/catalogue/bsdata'
import { createUnit } from '../../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'
import { ticks } from './charts'
import { forecast } from './StatsPage'

const raw = import.meta.glob('../../data/catalogue/fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const catalogue = parseBsData(Object.entries(raw).map(([p, text]) => ({ name: p.split('/').pop()!, text })), { repo: 'BSData/wh40k-11e', commit: 'c', fetchedAt: 'f' })

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], events: {}, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES, catalogue: null, shopItems: [], shopLists: [] })
})

describe('Stats', () => {
  it('shows tiles, charts and points painted per faction', async () => {
    const now = new Date().toISOString()
    let n = 0
    const unit = createUnit({ customName: 'Squad', factionName: 'Testers', datasheetId: 'u-troopers', groups: [{ count: 4, status: 'painted' }, { count: 6, status: 'built' }] }, { now, newId: () => `id${++n}` })
    await appDb.units.put(unit)
    await appDb.statusEvents.put({ id: 'e1', unitId: unit.id, groupId: unit.groups[0].id, from: 'built', to: 'painted', count: 4, date: now, direction: 'forward', note: '' })
    await appDb.shopItems.put({ id: 's1', kind: 'other', name: 'Glue', qty: 1, price: 12, bought: true, sources: [], listIds: ['main'], createdAt: now, updatedAt: now } as never)
    await appDb.units.put(createUnit({ customName: 'Other', factionName: 'Orks', groups: [{ count: 2, status: 'built' }] }, { now, newId: () => `o${++n}` }))
    const user = userEvent.setup()
    render(<App />)
    // Set the catalogue only after the app has loaded, or loading replaces it.
    await waitFor(() => expect(useStore.getState().ready).toBe(true))
    useStore.setState({ catalogue })
    await user.click(screen.getByRole('button', { name: 'Stats' }))

    const tiles = within(screen.getByRole('region', { name: 'Summary' }))
    expect(await tiles.findByText('Painted this month')).toBeTruthy()
    expect(tiles.getByText('Molehill')).toBeTruthy()
    expect(tiles.getByText('+8')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Models painted per month' })).toBeTruthy()
    const factions = within(screen.getByRole('region', { name: 'By faction' }))
    expect(await factions.findByText('64 / 160 pts')).toBeTruthy()
    expect(factions.getByText('4 / 10 (40%)')).toBeTruthy()

    const records = within(screen.getByRole('region', { name: 'Records' }))
    expect(records.getByText('Best month').nextSibling?.textContent).toBe('4')
    expect(screen.getByRole('img', { name: 'Models moved per day over the last year' }).querySelectorAll(`[data-day="${now.slice(0, 10)}"].fill-accent`)).toHaveLength(1)
    expect(screen.getByRole('img', { name: 'Models moved into each stage' }).querySelectorAll('[data-bar]')).toHaveLength(1)
    expect(within(screen.getByRole('region', { name: 'Pile age' })).getByText('Squad')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'By role' })).getByText('4 / 10')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Spending' })).getByText('€12 in this range')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Paint usage' })).getByText(/0 of your 0 paints/)).toBeTruthy()
    const pile = screen.getByRole('img', { name: 'Unpainted models over time' })
    await user.hover(pile.querySelectorAll('rect')[pile.querySelectorAll('rect').length - 1])
    expect(screen.getByRole('tooltip').textContent).toContain('Pile8')
    await user.hover(screen.getByRole('img', { name: 'Models painted per month' }).querySelectorAll('rect')[11])
    expect(screen.getByRole('tooltip').textContent).toContain('Painted4')
    await user.unhover(screen.getByRole('img', { name: 'Models painted per month' }))
    await user.selectOptions(screen.getByLabelText('Faction'), 'Orks')
    expect(tiles.getByText('+2')).toBeTruthy()
    expect(factions.queryByText('Testers')).toBeNull()
    const bars = () => screen.getByRole('img', { name: 'Models painted per month' }).querySelectorAll('[data-bar]')
    await user.click(screen.getByRole('button', { name: '6M' }))
    expect(bars()).toHaveLength(6)
    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(bars()).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '3M' }))
    expect(screen.getByRole('img', { name: 'Models painted per month' }).querySelectorAll('[data-bar]')).toHaveLength(13)
    await user.hover(screen.getByRole('img', { name: 'Models painted per month' }).querySelectorAll('rect')[12])
    expect(screen.getByRole('tooltip').textContent).toMatch(/^Week of/)
  })

  it('picks round axis ticks', () => {
    expect([ticks(0), ticks(7), ticks(40), ticks(130)]).toEqual([[0, 1], [0, 2, 4, 6, 8], [0, 10, 20, 30, 40], [0, 50, 100, 150]])
  })

  it('words the finish estimate', () => {
    expect([forecast(undefined), forecast(0), forecast(1), forecast(14), forecast(30)]).toEqual(['—', 'Done', 'about 1 month', 'about 14 months', 'about 3 years'])
  })
})

describe('Costs', () => {
  it('adds a purchase shared by units and shows spent and value painted vs unpainted', async () => {
    const now = new Date().toISOString()
    let n = 0
    const ctx = { now, newId: () => `c${++n}` }
    await appDb.units.put({ ...createUnit({ customName: 'Squad', groups: [{ count: 5, status: 'painted' }, { count: 5, status: 'built' }] }, ctx), price: 10 })
    await appDb.units.put(createUnit({ customName: 'Tanks', groups: [{ count: 2, status: 'built' }] }, ctx))
    await appDb.units.put(createUnit({ customName: 'Bikes', groups: [{ count: 3, status: 'built' }] }, ctx))
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(useStore.getState().ready).toBe(true))
    await user.click(screen.getByRole('button', { name: 'Stats' }))
    const costs = within(await screen.findByRole('region', { name: 'Costs' }))
    expect(costs.getByText('2 units have no price yet: set it on the unit or add a purchase.')).toBeTruthy()

    await user.click(costs.getByRole('button', { name: '+ Purchase' }))
    const form = within(costs.getByRole('form', { name: 'Purchase' }))
    await user.click(form.getByRole('button', { name: 'Save purchase' }))
    expect(form.getByRole('alert')).toHaveTextContent('needs a name')
    await user.type(form.getByLabelText('Name'), 'Bundle')
    const price = form.getByLabelText('Price (€)')
    await user.clear(price)
    await user.type(price, '50')
    await user.type(form.getByLabelText('Filter units'), 'ta')
    expect(form.queryByLabelText('Bikes')).toBeNull()
    await user.click(form.getByLabelText('Tanks'))
    await user.clear(form.getByLabelText('Filter units'))
    await user.click(form.getByLabelText('Bikes'))
    await user.click(form.getByRole('button', { name: 'Save purchase' }))

    expect(await costs.findByText('Bundle')).toBeTruthy()
    expect(costs.getByText('Tanks, Bikes')).toBeTruthy()
    const value = (label: string) => costs.getByText(label).nextSibling?.textContent
    expect(value('Total spent')).toBe('€60')
    expect(value('Value painted')).toBe('€5')
    expect(value('Value unpainted')).toBe('€55')
    expect(costs.queryByText(/no price yet/)).toBeNull()

    await user.click(costs.getByRole('button', { name: 'Edit Bundle' }))
    await user.click(within(costs.getByRole('form', { name: 'Purchase' })).getByRole('button', { name: 'Cancel' }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(costs.getByRole('button', { name: 'Delete Bundle' }))
    expect(costs.queryByText('Bundle')).toBeNull()
    await useStore.getState().setCurrency('£')
    expect((await costs.findAllByText('£10')).length).toBeGreaterThan(0)
  })
})
