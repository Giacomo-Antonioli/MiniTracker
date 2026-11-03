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
  useStore.setState({ ready: false, units: [], events: {}, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES, catalogue: null, paints: [], paintStock: new Map() })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

async function openPaints() {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText(/Your backlog is empty/)
  await user.click(screen.getByRole('button', { name: 'Paints' }))
  await screen.findByRole('list', { name: 'Paints' })
  return user
}

describe('Paints page', () => {
  it('lists the bundled paints with search and brand filter', async () => {
    const user = await openPaints()
    expect(Number(screen.getByText(/^\d+ paints$/).textContent!.split(' ')[0])).toBeGreaterThan(1500)
    await user.type(screen.getByPlaceholderText(/Search name or brand/), 'macragge blue')
    expect(screen.getByRole('button', { name: 'Macragge Blue (Citadel)' })).toBeInTheDocument()
    await user.clear(screen.getByPlaceholderText(/Search name or brand/))
    await user.selectOptions(within(screen.getByRole('region', { name: 'Paint filters' })).getByLabelText('Brand'), 'Vallejo')
    expect(Number(screen.getByText(/^\d+ paints$/).textContent!.split(' ')[0])).toBeLessThan(400)
  })

  it('shows colour matches in the panel and from a hex colour', async () => {
    const user = await openPaints()
    await user.type(screen.getByPlaceholderText(/Search name or brand/), 'macragge blue')
    await user.click(screen.getByRole('button', { name: 'Macragge Blue (Citadel)' }))
    let panel = screen.getByRole('complementary', { name: 'Paint details' })
    await user.click(within(panel).getByRole('button', { name: 'I own it' }))
    const match = within(panel).getByRole('region', { name: 'Colour match' })
    await user.selectOptions(within(match).getByLabelText('Match brand'), 'Vallejo')
    const vallejo = within(match).getByRole('list', { name: 'Closest in Vallejo' })
    const first = within(vallejo).getAllByRole('listitem')[0]
    const name = first.textContent!.split(' · ')[0]
    await user.click(first)
    panel = screen.getByRole('complementary', { name: 'Paint details' })
    expect(within(panel).getByRole('heading', { level: 2 })).toHaveTextContent(name)

    await user.click(screen.getByRole('button', { name: /Match a colour/ }))
    const dialog = screen.getByRole('dialog', { name: 'Match a colour' })
    await user.clear(within(dialog).getByLabelText('Hex'))
    await user.type(within(dialog).getByLabelText('Hex'), '#0d407f')
    const owned = within(dialog).getByRole('list', { name: 'Closest you own' })
    await user.click(within(owned).getByText(/Macragge Blue/))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(screen.getByRole('complementary', { name: 'Paint details' })).getByRole('heading', { level: 2 })).toHaveTextContent('Macragge Blue')
  })

  it('adds a paint to the inventory and edits its stock', async () => {
    const user = await openPaints()
    await user.type(screen.getByPlaceholderText(/Search name or brand/), 'nuln oil')
    await user.click(screen.getAllByRole('button', { name: /Nuln Oil \(Citadel\)/ })[0])
    const panel = screen.getByRole('complementary', { name: 'Paint details' })
    await user.click(within(panel).getByRole('button', { name: 'I own it' }))

    expect(within(panel).getByLabelText('Pots owned')).toHaveTextContent('1')
    await user.click(within(panel).getByRole('button', { name: 'One pot more' }))
    expect(within(panel).getByLabelText('Pots owned')).toHaveTextContent('2')
    await user.type(within(panel).getByLabelText('Location'), 'Drawer A')
    await user.tab()
    await user.click(within(panel).getByRole('button', { name: 'Mark running low' }))

    const stats = screen.getByRole('region', { name: 'Paint stats' })
    expect(stats).toHaveTextContent('1 paints owned')
    expect(stats).toHaveTextContent('2 pots')
    expect(stats).toHaveTextContent('1 running low')
    const stock = [...useStore.getState().paintStock.values()][0]
    expect(stock).toMatchObject({ quantity: 2, location: 'Drawer A', stage: 'low' })
  })

  it('wishlist paints have no pots, and the owned filter hides them', async () => {
    const user = await openPaints()
    await user.type(screen.getByPlaceholderText(/Search name or brand/), 'macragge blue')
    await user.click(screen.getByRole('button', { name: 'Macragge Blue (Citadel)' }))
    await user.click(within(screen.getByRole('complementary', { name: 'Paint details' })).getByRole('button', { name: 'Add to wishlist' }))
    expect(screen.getByRole('region', { name: 'Paint stats' })).toHaveTextContent('1 on wishlist')
    await user.click(screen.getByLabelText('Owned'))
    expect(screen.queryByRole('button', { name: 'Macragge Blue (Citadel)' })).not.toBeInTheDocument()
  })

  it('creates and deletes a custom paint', async () => {
    const user = await openPaints()
    await user.click(screen.getByRole('button', { name: '+ Custom paint' }))
    const d = screen.getByRole('dialog', { name: 'Add custom paint' })
    await user.type(within(d).getByLabelText('Brand *'), 'Green Stuff World')
    await user.type(within(d).getByLabelText('Name *'), 'Rocket Green')
    const hex = within(d).getByLabelText('Hex colour')
    await user.clear(hex)
    await user.type(hex, '#7fd13b')
    await user.click(within(d).getByRole('button', { name: 'Add paint' }))

    const panel = await screen.findByRole('complementary', { name: 'Paint details' })
    expect(panel).toHaveTextContent('Rocket Green')
    expect(panel).toHaveTextContent('Green Stuff World')
    expect(within(panel).getByLabelText('Pots owned')).toHaveTextContent('1')
    await user.click(within(panel).getByRole('button', { name: 'Delete custom paint' }))
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Paint details' })).not.toBeInTheDocument())
    expect(useStore.getState().paintStock.size).toBe(0)
  })

  it('shows a clear error for a bad colour', async () => {
    const user = await openPaints()
    await user.click(screen.getByRole('button', { name: '+ Custom paint' }))
    const d = screen.getByRole('dialog', { name: 'Add custom paint' })
    await user.type(within(d).getByLabelText('Brand *'), 'X')
    await user.type(within(d).getByLabelText('Name *'), 'Y')
    await user.clear(within(d).getByLabelText('Hex colour'))
    await user.type(within(d).getByLabelText('Hex colour'), 'blue')
    await user.click(within(d).getByRole('button', { name: 'Add paint' }))
    expect(within(d).getByRole('alert')).toHaveTextContent(/hex/)
  })

  it('imports an inventory CSV', async () => {
    const user = await openPaints()
    const csv = 'brand,name,quantity,location\nCitadel,Nuln Oil,2,Drawer B\nGreen Stuff World,Rocket Green,1,\n'
    await user.upload(screen.getByLabelText('Paint CSV file'), new File([csv], 'paints.csv', { type: 'text/csv' }))
    // Loading the bundled paints can be slow when the whole suite runs with coverage.
    expect(await screen.findByText(/Imported 2 paints \(1 new custom\)/, undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Paint stats' })).toHaveTextContent('2 paints owned')
  })

  it('prints the paints chosen schemes need that I do not own', async () => {
    const step = (paintId: string) => ({ id: paintId, technique: 'Basecoat', paints: [{ paintId }], notes: '' })
    const scheme = (id: string, name: string, origin: string, ids: string[]) => ({ id, name, description: '', origin, stage: 'final', tags: [], tips: '', tutorials: [], createdAt: 't', updatedAt: 't', sections: [{ id: 's', area: 'Armour', steps: ids.map(step) }] })
    await appDb.schemes.bulkPut([scheme('a', 'Sept', 'personal', ['ak_interactive/3b-au-zb-au', 'gone']), scheme('b', 'Studio', 'official', ['ak_interactive/3b-au-zb-au'])] as never)
    await useStore.getState().load()
    const user = await openPaints()
    const print = vi.fn()
    window.print = print
    await user.click(screen.getByRole('button', { name: 'Paints to buy…' }))
    const dialog = screen.getByRole('dialog', { name: 'Paints to buy' })
    expect(dialog).toHaveTextContent('2 paints to buy from 1 scheme')
    await user.click(within(dialog).getByRole('button', { name: 'None' }))
    expect(within(dialog).getByRole('button', { name: 'Print / save PDF' })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'All' }))
    await user.click(within(dialog).getByLabelText(/Sept/))
    expect(dialog).toHaveTextContent('1 paint to buy from 1 scheme')
    await user.click(within(dialog).getByLabelText(/Sept/))
    await user.click(within(dialog).getByRole('button', { name: 'Print / save PDF' }))
    await vi.waitFor(() => expect(print).toHaveBeenCalled())
    const sheet = screen.getByLabelText('Missing paints sheet')
    expect(sheet).toHaveTextContent('Paints to buy (2)For: Sept, Studio☐AK Interactive3B Au/Zb AuSept, Studio☐goneSept')
    window.dispatchEvent(new Event('afterprint'))
    await waitFor(() => expect(screen.queryByLabelText('Missing paints sheet')).toBeNull())
  })
})
