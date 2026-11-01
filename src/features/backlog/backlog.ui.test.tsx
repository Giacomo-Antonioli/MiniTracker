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
  useStore.setState({ ready: false, units: [], events: {}, pipeline: DEFAULT_PIPELINE })
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

describe('Pipeline settings UI', () => {
  it('adds a stage and blocks deleting one in use', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Your backlog is empty/)
    await addUnit(user, 'Rhino', 'Ultramarines', 1, 'built')
    await user.click(screen.getByRole('button', { name: 'Pipeline' }))
    await user.type(screen.getByPlaceholderText(/New stage name/), 'Washed')
    await user.click(screen.getByRole('button', { name: 'Add stage' }))
    expect(await screen.findByDisplayValue('Washed')).toBeInTheDocument()

    const builtRow = screen.getByDisplayValue('Built').closest('li')!
    await user.click(within(builtRow).getByRole('button', { name: 'Delete stage' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/in use/)
  })
})
