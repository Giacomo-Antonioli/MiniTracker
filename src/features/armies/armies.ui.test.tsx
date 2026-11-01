// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { parseBsData } from '../../data/catalogue/bsdata'
import { createUnit } from '../../domain/collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'

const raw = import.meta.glob('../../data/catalogue/fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const catalogue = parseBsData(Object.entries(raw).map(([p, text]) => ({ name: p.split('/').pop()!, text })), { repo: 'BSData/wh40k-11e', commit: 'c', fetchedAt: '2026-11-01T00:00:00.000Z' })

async function start(cat: object = catalogue) {
  await appDb.delete()
  await appDb.open()
  await appDb.catalogues.put(cat as never)
  let n = 0
  await appDb.units.put(createUnit({ customName: 'My walker', datasheetId: 'u-walker', groups: [{ count: 1, status: 'built' }] }, { now: 't', newId: () => `u${++n}` }))
  useStore.setState({ ready: false, units: [], lists: [], catalogue: null, pipeline: DEFAULT_PIPELINE })
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText('My walker')
  await user.click(screen.getByRole('button', { name: 'Armies' }))
  return user
}

beforeEach(() => localStorage.clear())

describe('Armies', () => {
  it('creates a list, adds owned units, flags rules and ownership, and shows it in the overview', async () => {
    const user = await start()
    expect(screen.getByText(/No army lists yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    const form = screen.getByRole('form', { name: 'New list' })
    expect(within(form).getByLabelText('Battle size')).toHaveDisplayValue('Strike Force (2000 pts)')
    await user.type(within(form).getByLabelText('Name'), 'Walkers')
    await user.click(within(form).getByRole('button', { name: 'Create' }))

    // Add panel: only owned units until "Not owned" is ticked.
    const add = await screen.findByRole('region', { name: 'Add units' })
    expect(within(add).getByRole('button', { name: 'Add Big Walker' })).toBeInTheDocument()
    expect(within(add).queryByRole('button', { name: 'Add Line Troopers' })).toBeNull()
    await user.click(within(add).getByLabelText('Not owned'))
    expect(within(add).getByRole('button', { name: 'Add Line Troopers' })).toBeInTheDocument()

    // The first unit sets the faction; a unit in two factions asks which one.
    await user.click(within(add).getByRole('button', { name: 'Add Big Walker' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Choose faction' })).getByRole('button', { name: 'Testers' }))
    expect(screen.getByLabelText('Faction')).toHaveDisplayValue('Testers')
    expect(screen.getByLabelText('Faction')).toBeDisabled()

    const issues = screen.getByRole('region', { name: 'Issues' })
    expect(within(issues).getByText('⚠ Needs at least 1 Character')).toBeInTheDocument()
    expect(within(issues).getByText('⚠ Choose a Warlord')).toBeInTheDocument()

    for (let i = 0; i < 3; i++) await user.click(within(add).getByRole('button', { name: 'Add Big Walker' }))
    expect(within(issues).getByText('⚠ Big Walker: 4, max 3')).toBeInTheDocument()
    const entries = screen.getAllByTestId('entry')
    expect(entries).toHaveLength(4)
    expect(entries[0]).toHaveTextContent('✅')
    expect(entries[1]).toHaveTextContent('✖ 0/1')

    // Incursion lowers the limit to 2 and the points limit to 1000.
    await user.selectOptions(screen.getByLabelText('Battle size'), 'Incursion')
    expect(within(issues).getByText('⚠ Big Walker: 4, max 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Points limit')).toHaveValue(1000)

    await user.click(screen.getAllByRole('button', { name: 'Warlord: Big Walker' })[0])
    expect(within(issues).getByText(/is not a Character/)).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Remove Big Walker' })[3])
    expect(screen.getAllByTestId('entry')).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: '← Armies' }))
    const row = within(screen.getByRole('list', { name: 'Army lists' })).getByRole('button', { name: /Walkers/ })
    expect(row).toHaveTextContent('450 / 1000 pts')
    expect(row).toHaveTextContent('Testers · 11th edition · Incursion')
    expect(row).toHaveTextContent('🟡 Missing 2 models')
    expect(row).toHaveTextContent('⚠ 3 rule issues')
    await user.click(screen.getByRole('button', { name: 'Complete' }))
    expect(screen.getByText('No lists match this filter.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Rule issues' }))
    expect(screen.getByRole('button', { name: /Walkers/ })).toBeInTheDocument()

    // Saved: still there after a reload.
    expect((await appDb.lists.toArray())[0]).toMatchObject({ name: 'Walkers', factionId: 'cat-testers', pointsLimit: 1000 })
  })

  it('asks to download again when the catalogue has no rule data', async () => {
    const { muster: _, ...old } = catalogue
    const user = await start({ ...old, formatVersion: 2 })
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    await user.type(screen.getByLabelText('Name'), 'Old')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByRole('region', { name: 'Rule checks unavailable' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Issues' })).toBeNull()
    await user.click(screen.getByRole('button', { name: '← Armies' }))
    expect(screen.getByRole('button', { name: /Old/ })).toHaveTextContent('Rules not checked')
  })

  it('deletes a list', async () => {
    const user = await start()
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    await user.type(screen.getByLabelText('Name'), 'Gone')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    window.confirm = () => true
    await user.click(await screen.findByRole('button', { name: 'Delete list' }))
    expect(screen.getByText(/No army lists yet/)).toBeInTheDocument()
    expect(await appDb.lists.count()).toBe(0)
  })
})
