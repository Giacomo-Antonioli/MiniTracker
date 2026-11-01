// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { parseBsData } from '../../data/catalogue/bsdata'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'

const raw = import.meta.glob('../../data/catalogue/fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const catalogue = parseBsData(
  Object.entries(raw).map(([p, text]) => ({ name: p.split('/').pop()!, text })),
  { repo: 'test', commit: 'c', fetchedAt: '2026-11-01T00:00:00.000Z' },
)

async function start(withCatalogue = true) {
  await appDb.delete()
  await appDb.open()
  if (withCatalogue) await appDb.catalogues.put(catalogue)
  useStore.setState({ ready: false, units: [], events: {}, pipeline: DEFAULT_PIPELINE, catalogue: null })
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText(/Your backlog is empty/)
  await user.click(screen.getByRole('button', { name: /^Catalogue$/ }))
  return user
}

describe('Catalogue browser', () => {
  it('points to the settings when no catalogue is installed', async () => {
    const user = await start(false)
    await user.click(screen.getByRole('button', { name: /Go to Settings/ }))
    expect(screen.getByRole('heading', { name: 'Unit catalogue' })).toBeInTheDocument()
  })

  it('lists units and filters by search, faction and role', async () => {
    const user = await start()
    expect(screen.getByText('4 of 5 units · Test Game')).toBeInTheDocument() // Legends hidden
    await user.type(screen.getByPlaceholderText(/Search name/), 'big')
    expect(screen.getAllByRole('row')).toHaveLength(3) // header + 2
    await user.clear(screen.getByPlaceholderText(/Search name/))
    const filters = screen.getByRole('region', { name: 'Catalogue filters' })
    await user.selectOptions(within(filters).getByLabelText('Role'), 'Battleline')
    expect(screen.getByRole('cell', { name: 'Line Troopers' })).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'Big Walker' })).not.toBeInTheDocument()
    await user.click(within(filters).getByLabelText('Legends'))
    await user.selectOptions(within(filters).getByLabelText('Role'), '')
    await user.selectOptions(within(filters).getByLabelText('Faction'), 'cat-sub')
    expect(screen.getByRole('cell', { name: /Old Hero/ })).toBeInTheDocument()
  })

  it('shows datasheet details and adds it to the collection', async () => {
    const user = await start()
    await user.click(screen.getByRole('cell', { name: 'Line Troopers' }))
    const panel = screen.getByRole('complementary', { name: 'Datasheet details' })
    expect(within(panel).getByRole('table', { name: 'Points by unit size' })).toHaveTextContent('5 models80 pts6–10 models160 pts')
    expect(panel).toHaveTextContent('Hold the Line')
    expect(panel).toHaveTextContent('Not in your collection')

    await user.click(within(panel).getByRole('button', { name: '+ Add to collection' }))
    const d = screen.getByRole('dialog', { name: 'Add unit' })
    expect(within(d).getByRole('combobox', { name: 'Name *' })).toHaveValue('Line Troopers')
    expect(within(d).getByLabelText('Models')).toHaveValue(5)
    await user.click(within(d).getByRole('button', { name: 'Save' }))

    expect(await within(panel).findByText('You own 5 models in 1 unit')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Line Troopers/ })).toHaveTextContent('5 ✓')
    await user.click(screen.getByLabelText('Owned only'))
    const list = screen.getAllByRole('table')[0]
    expect(within(list).getAllByRole('row')).toHaveLength(2)
  })
})
