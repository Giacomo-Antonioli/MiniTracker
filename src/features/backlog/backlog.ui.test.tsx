// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], events: {}, pipeline: DEFAULT_PIPELINE, catalogue: null })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

async function addUnit(user: ReturnType<typeof userEvent.setup>, name: string, faction: string, count: number, stage: string) {
  await user.click(screen.getByRole('button', { name: '+ Add unit' }))
  const d = screen.getByRole('dialog', { name: 'Add unit' })
  await user.type(within(d).getByLabelText('Name *'), name)
  await user.type(within(d).getByLabelText('Faction'), faction)
  const models = within(d).getByLabelText('Models')
  await user.clear(models)
  await user.type(models, String(count))
  await user.selectOptions(within(d).getByLabelText('Stage'), stage)
  await user.click(within(d).getByRole('button', { name: 'Save' }))
  await screen.findByRole('cell', { name: new RegExp(name) })
}

describe('Backlog UI', () => {
  it('shows the empty state', async () => {
    render(<App />)
    expect(await screen.findByText(/Your backlog is empty/)).toBeInTheDocument()
  })

  it('adds a unit and updates the summary', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Your backlog is empty/)
    await addUnit(user, 'Intercessors', 'Ultramarines', 5, 'painted')
    const summary = screen.getByRole('region', { name: 'Summary' })
    expect(summary).toHaveTextContent('Painted 5 / 5 models')
    expect(summary).toHaveTextContent('100%')
  })

  it('shows a validation error for an empty name', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Your backlog is empty/)
    await user.click(screen.getByRole('button', { name: '+ Add unit' }))
    const d = screen.getByRole('dialog', { name: 'Add unit' })
    await user.type(within(d).getByLabelText('Name *'), '   ')
    await user.click(within(d).getByRole('button', { name: 'Save' }))
    expect(await within(d).findByRole('alert')).toHaveTextContent(/name/i)
  })

  it('filters by search text and faction', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Your backlog is empty/)
    await addUnit(user, 'Intercessors', 'Ultramarines', 5, 'built')
    await addUnit(user, 'Termagants', 'Tyranids', 10, 'sprue')

    await user.type(screen.getByPlaceholderText(/Search/), 'term')
    expect(screen.queryByRole('cell', { name: /Intercessors/ })).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /Termagants/ })).toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText(/Search/))
    const filters = screen.getByRole('region', { name: 'Filters' })
    await user.selectOptions(within(filters).getByLabelText('Faction'), 'Ultramarines')
    expect(screen.getByRole('cell', { name: /Intercessors/ })).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: /Termagants/ })).not.toBeInTheDocument()
  })

  it('moves models and records the note in history', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Your backlog is empty/)
    await addUnit(user, 'Intercessors', 'Ultramarines', 10, 'built')
    await user.click(screen.getByRole('cell', { name: /Intercessors/ }))
    const panel = screen.getByRole('complementary', { name: 'Unit details' })
    await user.click(within(panel).getByRole('button', { name: 'Move…' }))
    const d = screen.getByRole('dialog', { name: 'Move models' })
    const count = within(d).getByLabelText('How many')
    await user.clear(count)
    await user.type(count, '4')
    await user.type(within(d).getByLabelText('Note'), 'Sergeant first')
    await user.click(within(d).getByRole('button', { name: 'Move' }))

    expect(await within(panel).findByText(/Sergeant first/)).toBeInTheDocument()
    expect(within(panel).getByText(/4 models Built → Primed/)).toBeInTheDocument()
    expect(within(panel).getByText('6 ×')).toBeInTheDocument()
  })

  it('deletes a unit after confirmation', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Your backlog is empty/)
    await addUnit(user, 'Rhino', 'Ultramarines', 1, 'built')
    await user.click(screen.getByRole('cell', { name: /Rhino/ }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText(/Your backlog is empty/)).toBeInTheDocument()
  })
})

describe('Settings page', () => {
  it('edits the painting pipeline and blocks deleting a stage in use', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Your backlog is empty/)
    await addUnit(user, 'Rhino', 'Ultramarines', 1, 'built')
    await user.click(screen.getByRole('button', { name: /Settings/ }))
    const painting = screen.getByRole('region', { name: 'Painting pipeline' })
    await user.type(within(painting).getByPlaceholderText('New stage name'), 'Washed')
    await user.click(within(painting).getByRole('button', { name: 'Add stage' }))
    expect(await within(painting).findByDisplayValue('Washed')).toBeInTheDocument()

    const builtRow = within(painting).getByDisplayValue('Built').closest('li')!
    await user.click(within(builtRow).getByRole('button', { name: 'Delete stage' }))
    expect(await within(painting).findByRole('alert')).toHaveTextContent(/in use/)
  })

  it('has separate paint and scheme pipelines', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Your backlog is empty/)
    await user.click(screen.getByRole('button', { name: /Settings/ }))
    const paint = screen.getByRole('region', { name: 'Paint pipeline' })
    expect(within(paint).getByDisplayValue('Wishlist')).toBeInTheDocument()
    await user.type(within(paint).getByPlaceholderText('New stage name'), 'Gifted')
    await user.click(within(paint).getByRole('button', { name: 'Add stage' }))
    expect(await within(paint).findByDisplayValue('Gifted')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Scheme pipeline' })).getByDisplayValue('Idea')).toBeInTheDocument()
    expect(useStore.getState().pipelines.paint.stages.at(-1)?.name).toBe('Gifted')
  })

  it('switches theme from Appearance', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Your backlog is empty/)
    await user.click(screen.getByRole('button', { name: /Settings/ }))
    await user.selectOptions(screen.getByLabelText('Theme'), 'forum2005')
    expect(document.documentElement.dataset.theme).toBe('forum2005')
  })
})

describe('Catalogue banner', () => {
  it('shows on the backlog without a catalogue and can be hidden', async () => {
    const user = userEvent.setup()
    localStorage.removeItem('catalogueBannerDismissed')
    render(<App />)
    const banner = await screen.findByRole('region', { name: 'Catalogue missing' })
    expect(within(banner).getByRole('button', { name: /Download/ })).toBeEnabled()
    await user.click(within(banner).getByRole('button', { name: 'Hide this message' }))
    expect(screen.queryByRole('region', { name: 'Catalogue missing' })).not.toBeInTheDocument()
  })

  it('is not shown when a catalogue is installed', async () => {
    localStorage.removeItem('catalogueBannerDismissed')
    await appDb.catalogues.put({ gameId: 'g', gameName: 'G', source: { repo: 'r', commit: 'c', fetchedAt: 't' }, factions: [], datasheets: [] })
    render(<App />)
    await screen.findByText(/Your backlog is empty/)
    expect(screen.queryByRole('region', { name: 'Catalogue missing' })).not.toBeInTheDocument()
  })
})
