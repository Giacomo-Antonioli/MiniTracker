// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { parseBsData } from '../../data/catalogue/bsdata'
import { createUnit } from '../../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'
import { forecast } from './StatsPage'

const raw = import.meta.glob('../../data/catalogue/fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const catalogue = parseBsData(Object.entries(raw).map(([p, text]) => ({ name: p.split('/').pop()!, text })), { repo: 'BSData/wh40k-11e', commit: 'c', fetchedAt: 'f' })

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], events: {}, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES, catalogue: null })
})

describe('Stats', () => {
  it('shows tiles, charts and points painted per faction', async () => {
    const now = new Date().toISOString()
    let n = 0
    const unit = createUnit({ customName: 'Squad', factionName: 'Testers', datasheetId: 'u-troopers', groups: [{ count: 4, status: 'painted' }, { count: 6, status: 'built' }] }, { now, newId: () => `id${++n}` })
    await appDb.units.put(unit)
    await appDb.statusEvents.put({ id: 'e1', unitId: unit.id, groupId: unit.groups[0].id, from: 'built', to: 'painted', count: 4, date: now, direction: 'forward', note: '' })
    await appDb.units.put(createUnit({ customName: 'Other', factionName: 'Orks', groups: [{ count: 2, status: 'built' }] }, { now, newId: () => `o${++n}` }))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Stats' })
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

    await user.selectOptions(screen.getByLabelText('Faction'), 'Orks')
    expect(tiles.getByText('+2')).toBeTruthy()
    expect(factions.queryByText('Testers')).toBeNull()
    await user.selectOptions(screen.getByLabelText('Range'), '6')
    expect(screen.getByRole('img', { name: 'Models painted per month' }).querySelectorAll('rect')).toHaveLength(6)
  })

  it('words the finish estimate', () => {
    expect([forecast(undefined), forecast(0), forecast(1), forecast(14), forecast(30)]).toEqual(['—', 'Done', 'about 1 month', 'about 14 months', 'about 3 years'])
  })
})
