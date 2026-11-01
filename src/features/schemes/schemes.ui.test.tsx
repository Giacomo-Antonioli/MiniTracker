// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({
    ready: false, units: [], events: {}, photos: {}, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES,
    catalogue: null, paints: [], paintStock: new Map(), schemes: [], schemeDefaults: {},
  })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})

async function openSchemes() {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText(/Your backlog is empty/)
  await user.click(screen.getByRole('button', { name: 'Schemes' }))
  await waitFor(() => expect(useStore.getState().paints.length).toBeGreaterThan(0))
  return user
}

async function buildScheme(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '+ New scheme' }))
  const ed = await screen.findByRole('region', { name: 'Scheme editor' })
  const name = within(ed).getByLabelText('Scheme name')
  await user.clear(name)
  await user.type(name, 'Ultramarines Studio')
  await user.type(within(ed).getByPlaceholderText('e.g. Ultramarines'), 'Ultramarines')
  await user.click(within(ed).getByRole('button', { name: '+ Area' }))
  await user.click(within(ed).getByRole('button', { name: '+ Step' }))
  const step = within(ed).getByRole('listitem', { name: 'Step 1' })
  await user.type(within(step).getByLabelText('Technique'), 'basecoat')
  await user.type(within(step).getByRole('combobox', { name: 'Paint' }), 'macragge blue')
  await user.click(within(step).getByRole('option', { name: /Macragge Blue/ }))
  await user.click(within(ed).getByRole('button', { name: 'Save' }))
  await within(ed).findByRole('button', { name: 'Saved' })
  return ed
}

describe('Schemes', () => {
  it('creates a scheme with an area, a step and a paint, and flags missing paints', async () => {
    const user = await openSchemes()
    const ed = await buildScheme(user)
    expect(ed).toHaveTextContent('Missing paints (1): Macragge Blue (Citadel)')
    const s = useStore.getState().schemes[0]
    expect(s).toMatchObject({ name: 'Ultramarines Studio', factionName: 'Ultramarines', origin: 'personal', stage: 'idea' })
    expect(s.sections[0]).toMatchObject({ area: 'Armour', steps: [{ technique: 'basecoat', paints: [{ paintId: expect.stringContaining('macragge') }] }] })
    expect(screen.getByRole('button', { name: 'Scheme Ultramarines Studio' })).toHaveTextContent('1 paint missing')
  })

  it('community schemes need a source; saving shows the error', async () => {
    const user = await openSchemes()
    const ed = await buildScheme(user)
    await user.selectOptions(within(ed).getByRole('combobox', { name: 'Origin' }), 'community')
    await user.click(within(ed).getByRole('button', { name: 'Save' }))
    expect(within(ed).getByRole('alert')).toHaveTextContent(/source/)
    await user.type(within(ed).getByLabelText('Source link'), 'https://example.com/guide')
    await user.click(within(ed).getByRole('button', { name: 'Save' }))
    await within(ed).findByRole('button', { name: 'Saved' })
  })

  it('makes a personal variant linked to the original and compares paints', async () => {
    const user = await openSchemes()
    const ed = await buildScheme(user)
    await user.click(within(ed).getByRole('button', { name: /Make my variant/ }))
    await waitFor(() => expect(screen.getByLabelText('Scheme name')).toHaveValue('Ultramarines Studio (my variant)'))
    const v = screen.getByRole('region', { name: 'Scheme editor' })
    expect(v).toHaveTextContent('variant of Ultramarines Studio')
    const step = within(v).getByRole('listitem', { name: 'Step 1' })
    await user.click(within(step).getByRole('button', { name: /Remove Macragge Blue/ }))
    await user.type(within(step).getByRole('combobox', { name: 'Paint' }), 'kantor blue')
    await user.click(within(step).getAllByRole('option', { name: /Kantor Blue/ })[0])
    expect(v).toHaveTextContent(/added Kantor Blue .*dropped Macragge Blue/)
  })

  it('a faction default scheme is picked for new units of that faction', async () => {
    const user = await openSchemes()
    const ed = await buildScheme(user)
    await user.click(within(ed).getByRole('button', { name: /Make default for Ultramarines/ }))
    await user.click(screen.getByRole('button', { name: 'Backlog' }))
    await user.click(screen.getByRole('button', { name: '+ Add unit' }))
    const d = screen.getByRole('dialog', { name: 'Add unit' })
    await user.type(within(d).getByLabelText('Faction'), 'Ultramarines')
    await user.type(within(d).getByLabelText('Name *'), 'Hellblasters')
    expect((within(d).getByLabelText('Paint scheme') as HTMLSelectElement).selectedOptions[0].textContent).toContain('Ultramarines Studio')
    await user.click(within(d).getByRole('button', { name: 'Save' }))
    await user.click(await screen.findByRole('cell', { name: /Hellblasters/ }))
    expect(screen.getByRole('region', { name: 'Scheme' })).toHaveTextContent('Ultramarines Studio')
  })

  it('imports a shared scheme file with new ids', async () => {
    const user = await openSchemes()
    await buildScheme(user)
    const original = useStore.getState().schemes[0]
    const file = JSON.stringify({ format: 'minitracker-schemes', version: 1, schemes: [original], paints: [] })
    await user.upload(screen.getByLabelText('Scheme file'), new File([file], 's.json', { type: 'application/json' }))
    expect(await screen.findByText('Imported 1 scheme.')).toBeInTheDocument()
    const all = useStore.getState().schemes
    expect(all).toHaveLength(2)
    expect(new Set(all.map((s) => s.id)).size).toBe(2)
  })

  it('deleting a scheme unlinks it', async () => {
    const user = await openSchemes()
    const ed = await buildScheme(user)
    await user.click(within(ed).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(useStore.getState().schemes).toHaveLength(0))
    expect(screen.queryByRole('region', { name: 'Scheme editor' })).not.toBeInTheDocument()
  })
})
