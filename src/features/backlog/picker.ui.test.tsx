// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { parseBsData } from '../../data/catalogue/bsdata'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'

const raw = import.meta.glob('../../data/catalogue/fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const catalogue = parseBsData(
  Object.entries(raw).map(([p, text]) => ({ name: p.split('/').pop()!, text })),
  { repo: 'test', commit: 'c', fetchedAt: '2026-11-01T00:00:00.000Z' },
)

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  await appDb.catalogues.put(catalogue)
  useStore.setState({ ready: false, units: [], events: {}, pipeline: DEFAULT_PIPELINE, catalogue: null })
})

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await screen.findByText(/Your backlog is empty/)
  await user.click(screen.getByRole('button', { name: '+ Add unit' }))
  return screen.getByRole('dialog', { name: 'Add unit' })
}

describe('Unit picker', () => {
  it('searches the catalogue and fills name, faction, size and points', async () => {
    const user = userEvent.setup()
    const d = await openForm(user)
    await user.type(within(d).getByRole('combobox', { name: 'Name *' }), 'troop')
    const list = within(d).getByRole('listbox', { name: 'Name * suggestions' })
    const option = within(list).getByRole('option', { name: /Line Troopers/ })
    expect(option).toHaveTextContent('Battleline · 5–10 · 80 pts')
    await user.click(option)

    expect(within(d).getByRole('combobox', { name: 'Name *' })).toHaveValue('Line Troopers')
    expect(within(d).getByRole('combobox', { name: 'Faction' })).toHaveValue('Sub Testers')
    expect(within(d).getByLabelText('Models')).toHaveValue(5)
    expect(within(d).getByTestId('datasheet-link')).toHaveTextContent('5 models = 80 pts')

    const models = within(d).getByLabelText('Models')
    await user.clear(models)
    await user.type(models, '10')
    expect(within(d).getByTestId('datasheet-link')).toHaveTextContent('10 models = 160 pts')

    await user.click(within(d).getByRole('button', { name: 'Save' }))
    await user.click(await screen.findByRole('cell', { name: /Line Troopers/ }))
    expect(await screen.findByLabelText('Datasheet')).toHaveTextContent('Line Troopers · Battleline · 10 models · 160 pts')
    expect(useStore.getState().units[0]).toMatchObject({ datasheetId: 'u-troopers', factionId: 'cat-sub', factionName: 'Sub Testers' })
  })

  it('works with the keyboard and filters by the chosen faction', async () => {
    const user = userEvent.setup()
    const d = await openForm(user)
    const faction = within(d).getByRole('combobox', { name: 'Faction' })
    await user.type(faction, 'Testers')
    // First match is highlighted after typing; ↓ moves to the second one.
    await user.keyboard('{ArrowDown}{Enter}')
    expect(faction).toHaveValue('Testers')
    await user.clear(faction)
    await user.type(faction, 'sub')
    await user.keyboard('{Enter}')
    expect(faction).toHaveValue('Sub Testers')

    const name = within(d).getByRole('combobox', { name: 'Name *' })
    await user.click(name)
    const names = within(within(d).getByRole('listbox', { name: 'Name * suggestions' })).getAllByRole('option').map((o) => o.textContent)
    expect(names.some((n) => n?.includes('Old Hero'))).toBe(false) // Legends hidden by default
    await user.keyboard('{ArrowDown}{Enter}')
    expect(name).not.toHaveValue('')
    expect(within(d).getByTestId('datasheet-link')).toBeInTheDocument()
  })

  it('keeps a custom name when nothing matches, and can unlink', async () => {
    const user = userEvent.setup()
    const d = await openForm(user)
    await user.type(within(d).getByRole('combobox', { name: 'Name *' }), 'My Kitbash')
    expect(within(d).getByText(/No catalogue match/)).toBeInTheDocument()
    await user.click(within(d).getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('cell', { name: /My Kitbash/ })).toBeInTheDocument()
    expect(useStore.getState().units[0].datasheetId).toBeUndefined()
  })

  it('explains Legends with an info tooltip', async () => {
    const user = userEvent.setup()
    const d = await openForm(user)
    const info = within(d).getByRole('button', { name: 'What are Legends?' })
    expect(info).toHaveAccessibleDescription(/no longer updates/)
  })

  it('shows Legends units when asked', async () => {
    const user = userEvent.setup()
    const d = await openForm(user)
    await user.click(within(d).getByLabelText('Show Legends'))
    await user.type(within(d).getByRole('combobox', { name: 'Name *' }), 'hero')
    expect(within(d).getByRole('option', { name: /Old Hero \(Legends\)/ })).toBeInTheDocument()
  })
})
