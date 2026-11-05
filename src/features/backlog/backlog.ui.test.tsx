// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { createUnit } from '../../domain/collection/ownedUnit'

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
    expect(summary).toHaveTextContent('Units1Models owned5Wishlisted0Painted100%')
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
    const panel = await screen.findByRole('complementary', { name: 'Unit details' })
    await user.click(within(panel).getByRole('button', { name: 'Move with date, note or photo…' }))
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

  it('quick-moves one, a number, or all models; to the next stage unless another is picked', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Your backlog is empty/)
    await addUnit(user, 'Intercessors', 'Ultramarines', 10, 'built')
    await user.click(screen.getByRole('cell', { name: /Intercessors/ }))
    const panel = await screen.findByRole('complementary', { name: 'Unit details' })
    expect(within(panel).getByLabelText('Move Built to')).toHaveValue('primed')
    await user.click(within(panel).getByRole('button', { name: 'Move' }))
    expect(await within(panel).findByText('9 ×')).toBeInTheDocument()
    const n = within(panel).getByLabelText('How many Built to move')
    await user.clear(n)
    await user.type(n, '3')
    await user.click(within(n.closest('li')!).getByRole('button', { name: 'Move' }))
    expect(await within(panel).findByText('6 ×')).toBeInTheDocument()
    expect(within(panel).getByText('4 ×')).toBeInTheDocument()
    await user.selectOptions(within(panel).getByLabelText('Move Built to'), 'painted')
    await user.click(within(within(panel).getByLabelText('Move Built to').closest('li')!).getByRole('button', { name: 'All' }))
    expect(await within(panel).findByText(/6 models Built → Painted/)).toBeInTheDocument()
    expect(within(panel).queryByLabelText('Move Built to')).toBeNull()
  })

  it('deletes a unit after confirmation', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Your backlog is empty/)
    await addUnit(user, 'Rhino', 'Ultramarines', 1, 'built')
    await user.click(screen.getByRole('cell', { name: /Rhino/ }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
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
    expect(screen.getByRole('tab', { name: 'Catalogue data' })).toHaveAttribute('aria-selected', 'true')
    await user.click(await screen.findByRole('tab', { name: 'Pipelines' }))
    const painting = screen.getByRole('group', { name: 'Painting pipeline' })
    await user.click(within(painting).getByText('Painting pipeline'))
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
    await user.click(await screen.findByRole('tab', { name: 'Pipelines' }))
    const paint = screen.getByRole('group', { name: 'Paint pipeline' })
    expect(within(paint).getByDisplayValue('Wishlist')).toBeInTheDocument()
    await user.type(within(paint).getByPlaceholderText('New stage name'), 'Gifted')
    await user.click(within(paint).getByRole('button', { name: 'Add stage' }))
    expect(await within(paint).findByDisplayValue('Gifted')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Scheme pipeline' })).getByDisplayValue('Idea')).toBeInTheDocument()
    expect(useStore.getState().pipelines.paint.stages.at(-1)?.name).toBe('Gifted')
  })

  it('switches theme from Appearance', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Your backlog is empty/)
    await user.click(screen.getByRole('button', { name: /Settings/ }))
    await user.click(await screen.findByRole('tab', { name: 'Appearance' }))
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

  it('groups entries of the same unit type; expands, sorts and hides columns', async () => {
    localStorage.clear()
    localStorage.setItem('startPage', 'backlog')
    useStore.setState({ backlogFilter: {} })
    let n = 0
    const c = { now: '2026-01-01T00:00:00.000Z', newId: () => `g${++n}` }
    await appDb.units.bulkPut([
      createUnit({ customName: 'Squad A', datasheetId: 'int', factionName: 'UM', groups: [{ count: 5, status: 'painted' }] }, c),
      createUnit({ customName: 'Squad B', datasheetId: 'int', factionName: 'UM', groups: [{ count: 3, status: 'built' }, { count: 2, status: 'wishlisted' }] }, c),
      createUnit({ customName: 'Alpha tank', groups: [{ count: 1, status: 'sprue' }] }, c),
    ])
    const user = userEvent.setup()
    render(<App />)
    const group = await screen.findByRole('row', { name: /Squad A ×2/ })
    expect(group).toHaveTextContent('8 (+2 wishlisted)')
    expect(within(group).getByLabelText(/Stages: Wishlisted 2 · Built 3 · Painted 5/)).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: /Squad B/ })).toBeNull()
    await user.click(group)
    expect(screen.getByRole('cell', { name: /Squad B/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Collapse all' }))
    expect(screen.queryByRole('cell', { name: /Squad B/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(screen.getByRole('cell', { name: /Squad B/ })).toBeInTheDocument()

    const names = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent!.split(/\s{0}(?=UM|—)/)[0].replace(/^[▸▾]/, '').trim().slice(0, 9))
    expect(names()[0]).toMatch(/Alpha tan/)
    await user.click(screen.getByRole('button', { name: /^Unit/ }))
    expect(names()[0]).toMatch(/Squad A/)
    await user.click(screen.getByRole('button', { name: /^Models/ }))
    expect(screen.getByRole('columnheader', { name: /Models/ })).toHaveAttribute('aria-sort', 'ascending')

    await user.click(screen.getByRole('button', { name: 'Columns' }))
    await user.click(within(screen.getByRole('group', { name: 'Columns' })).getByLabelText('Stages'))
    expect(screen.queryByRole('columnheader', { name: 'Stages' })).toBeNull()
    expect(JSON.parse(localStorage.getItem('backlog.hidden')!)).toEqual(['stages'])
    await user.click(screen.getByRole('button', { name: 'Show models of Squad B' }))
    expect(screen.getByRole('row', { name: '2 × Wishlisted' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show models of Squad A' })).toBeNull()
    expect(screen.getByRole('row', { name: '3 × Built' })).toHaveTextContent('—')
    expect(screen.getByRole('region', { name: 'Summary' })).toHaveTextContent('Units3Models owned9Wishlisted2Painted56%')
  })
})

describe('Backlog schemes', () => {
  it('shows the scheme paint colours on entries', async () => {
    useStore.setState({ backlogFilter: {}, paints: [] })
    await appDb.schemes.put({ id: 'sc1', name: 'Sept', description: '', origin: 'personal', stage: 'final', tags: [], tips: '', tutorials: [], createdAt: 't', updatedAt: 't', sections: [{ id: 's', area: 'Armour', steps: [{ id: 'p', technique: 'Basecoat', paints: [{ paintId: 'ak_interactive/3b-au-zb-au' }], notes: '' }] }] } as never)
    await appDb.units.put({ ...createUnit({ customName: 'Crisis', groups: [{ count: 3, status: 'built' }] }, { now: 't', newId: () => 'c1' }), schemeId: 'sc1' })
    render(<App />)
    const strip = await screen.findByLabelText('1 paint colours')
    expect(strip.closest('[title]')).toHaveAttribute('title', 'Sept')
    expect((strip.firstElementChild as HTMLElement).style.background).toMatch(/#1f2211|rgb\(31, 34, 17\)/)
    await userEvent.setup().click(screen.getByRole('cell', { name: /Crisis/ }))
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Edit' }))
    expect(within(screen.getByRole('dialog')).getByLabelText('1 paint colours')).toBeInTheDocument()
  })
})
