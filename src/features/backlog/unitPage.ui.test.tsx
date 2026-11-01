// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { parseBsData } from '../../data/catalogue/bsdata'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'

const raw = import.meta.glob('../../data/catalogue/fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const catalogue = parseBsData(Object.entries(raw).map(([p, text]) => ({ name: p.split('/').pop()!, text })), { repo: 't', commit: 'c', fetchedAt: '2026-11-01T00:00:00.000Z' })

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  await appDb.catalogues.put(catalogue)
  useStore.setState({ ready: false, units: [], events: {}, photos: {}, pipeline: DEFAULT_PIPELINE, catalogue: null, backlogFilter: {} })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

async function withUnits() {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText(/Your backlog is empty/)
  for (const name of ['Line Troopers', 'Big Walker']) {
    await user.click(screen.getByRole('button', { name: '+ Add unit' }))
    const d = screen.getByRole('dialog', { name: 'Add unit' })
    await user.type(within(d).getByRole('combobox', { name: 'Name *' }), name)
    await user.click(within(d).getByRole('option', { name: new RegExp(name) }))
    await user.click(within(d).getByRole('button', { name: 'Save' }))
    await screen.findByRole('cell', { name: new RegExp(name) })
  }
  return user
}

describe('Unit page', () => {
  it('opens on double-click, shows the unit tag, and goes back with filters kept', async () => {
    const user = await withUnits()
    await user.type(screen.getByPlaceholderText(/Search name/), 'troop')
    await user.dblClick(screen.getByRole('cell', { name: /Line Troopers/ }))
    const page = screen.getByRole('article', { name: 'Unit page' })
    expect(within(page).getByRole('heading', { name: 'Line Troopers' })).toBeInTheDocument()
    const id = useStore.getState().units.find((u) => u.customName === 'Line Troopers')!.id
    expect(within(page).getByLabelText('Unit tag')).toHaveTextContent(`mt-${id.replace(/-/g, '').slice(0, 8)}`)
    expect(within(page).getByRole('region', { name: 'Photos' })).toBeInTheDocument()

    await user.click(within(page).getByRole('button', { name: '← Back to backlog' }))
    expect(screen.getByPlaceholderText(/Search name/)).toHaveValue('troop')
    expect(screen.queryByRole('cell', { name: /Big Walker/ })).not.toBeInTheDocument()
  })

  it('opens from the side panel button and edits from the page', async () => {
    const user = await withUnits()
    await user.click(screen.getByRole('cell', { name: /Big Walker/ }))
    await user.click(await screen.findByRole('button', { name: /Open page/ }))
    const page = screen.getByRole('article', { name: 'Unit page' })
    await user.click(within(page).getByRole('button', { name: 'Edit' }))
    const d = screen.getByRole('dialog', { name: 'Edit unit' })
    await user.type(within(d).getByLabelText('Notes'), 'Magnetised arms')
    await user.click(within(d).getByRole('button', { name: 'Save' }))
    expect(await within(page).findByText('Magnetised arms')).toBeInTheDocument()
  })

  it('links to the datasheet in the catalogue', async () => {
    const user = await withUnits()
    await user.dblClick(screen.getByRole('cell', { name: /Line Troopers/ }))
    await user.click(within(screen.getByLabelText('Datasheet')).getByRole('button', { name: 'Line Troopers' }))
    const panel = screen.getByRole('complementary', { name: 'Datasheet details' })
    expect(within(panel).getByRole('heading', { name: 'Line Troopers' })).toBeInTheDocument()
  })

  it('deleting from the page returns to the backlog', async () => {
    const user = await withUnits()
    await user.dblClick(screen.getByRole('cell', { name: /Big Walker/ }))
    await user.click(within(screen.getByRole('article', { name: 'Unit page' })).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('cell', { name: /Line Troopers/ })).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: /Big Walker/ })).not.toBeInTheDocument()
  })
})
