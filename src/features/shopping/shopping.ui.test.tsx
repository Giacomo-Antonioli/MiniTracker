// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'
import { parseBsData } from '../../data/catalogue/bsdata'
import { createUnit } from '../../domain/collection/ownedUnit'

const raw = import.meta.glob('../../data/catalogue/fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const catalogue = parseBsData(Object.entries(raw).map(([p, text]) => ({ name: p.split('/').pop()!, text })), { repo: 'BSData/wh40k-11e', commit: 'c', fetchedAt: 'f' })

const PAINT = 'ak_interactive/3b-au-zb-au'

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
  useStore.setState({ ready: false, units: [], events: {}, pipeline: DEFAULT_PIPELINE, pipelines: DEFAULT_PIPELINES, catalogue: null, paints: [], paintStock: new Map(), shopItems: [], shopLists: [] })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

async function open() {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText(/Your backlog is empty/)
  return user
}

describe('Shopping', () => {
  it('adds the paint wishlist to a new list, ticks a paint bought as in hand, and exports', async () => {
    await appDb.paintStock.put({ paintId: PAINT, stage: 'wishlist', quantity: 0, favourite: false, notes: '', updatedAt: 't' })
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Paints' }))
    await user.click(await screen.findByRole('button', { name: 'Wishlist to shopping list…' }))
    const add = screen.getByRole('dialog', { name: 'Add to shopping list' })
    await user.type(within(add).getByLabelText('New list'), 'GW order')
    await user.click(within(add).getByRole('button', { name: 'Add' }))

    await user.click(screen.getByRole('button', { name: 'Shopping' }))
    const nav = screen.getByRole('navigation', { name: 'Shopping lists' })
    expect(nav).toHaveTextContent('Main list (1)GW order (1)')
    await user.type(screen.getByLabelText('New item'), 'Brushes{Enter}')
    await user.type(screen.getByLabelText('Price of Brushes'), '4,5')
    await user.tab()
    await user.type(screen.getByLabelText('Shop for Brushes'), 'Amazon')
    expect(screen.getByRole('status')).toHaveTextContent('2 to buy · total 4.50 (+1 without price)')

    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await user.click(screen.getByRole('button', { name: 'Copy text' }))
    expect(writeText.mock.calls[0][0]).toBe('Shopping list\n\nAmazon\n- Brushes – 4.50\n\nAny shop\n- AK Interactive 3B Au/Zb Au\n\nTotal: 4.50 (+1 without price)')

    await user.click(screen.getByLabelText('Bought AK Interactive 3B Au/Zb Au'))
    await user.click(within(screen.getByRole('dialog', { name: /^Bought/ })).getByRole('button', { name: 'In hand' }))
    await waitFor(() => expect(useStore.getState().paintStock.get(PAINT)).toMatchObject({ stage: 'sealed', quantity: 1 }))
    expect(screen.getByRole('status')).toHaveTextContent('1 to buy · total 4.50 · 1 bought')

    const print = vi.fn()
    window.print = print
    await user.click(screen.getByRole('button', { name: 'Print / save PDF' }))
    await vi.waitFor(() => expect(print).toHaveBeenCalled())
    expect(screen.getByLabelText('Shopping sheet')).toHaveTextContent('☐Brushes1Amazon4.50Total4.50')
    window.dispatchEvent(new Event('afterprint'))
    await waitFor(() => expect(screen.queryByLabelText('Shopping sheet')).toBeNull())

    await user.click(within(nav).getByRole('button', { name: /GW order/ }))
    expect(screen.getByRole('table', { name: 'Items' })).toHaveTextContent('AK Interactive')
    expect(screen.getByRole('table', { name: 'Items' })).not.toHaveTextContent('Brushes')
  })

  it('moves items between lists, renames and deletes lists, unticks and removes items', async () => {
    const prompt = vi.spyOn(window, 'prompt')
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Shopping' }))
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument()
    prompt.mockReturnValueOnce('Local shop')
    await user.click(screen.getByRole('button', { name: '+ New list' }))
    await user.type(screen.getByLabelText('New item'), 'Sand{Enter}')
    prompt.mockReturnValueOnce('Corner shop')
    await user.click(screen.getByRole('button', { name: 'Rename' }))
    expect(screen.getByRole('heading', { name: 'Corner shop' })).toBeInTheDocument()
    await user.click(screen.getByLabelText('Bought Sand'))
    await user.click(screen.getByLabelText('Bought Sand'))
    expect(useStore.getState().shopItems[0].bought).toBe(false)
    await user.clear(screen.getByLabelText('Quantity of Sand'))
    await user.type(screen.getByLabelText('Quantity of Sand'), '3')
    await user.tab()
    expect(useStore.getState().shopItems[0].qty).toBe(3)
    await user.click(screen.getByRole('checkbox', { name: 'Corner shop' }))
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete list' }))
    expect(screen.getByRole('navigation', { name: 'Shopping lists' })).toHaveTextContent('Main list (1)')
    await user.click(screen.getByRole('button', { name: 'Remove Sand' }))
    expect(useStore.getState().shopItems).toEqual([])
    expect(await appDb.shopLists.count()).toBe(0)
  })

  it('adds catalogue units and paints; units go to the backlog as Wishlisted, asking when entries exist; bought models become owned', async () => {
    await appDb.catalogues.put(catalogue as never)
    await appDb.units.put(createUnit({ customName: 'My walker', datasheetId: 'u-walker', groups: [{ count: 1, status: 'built' }] }, { now: 't', newId: () => 'w1' }))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('My walker')
    await user.click(screen.getByRole('button', { name: 'Shopping' }))

    await user.type(screen.getByLabelText('Search catalogue'), 'troopers')
    await user.click(await screen.findByRole('button', { name: 'Add Line Troopers' }))
    await waitFor(() => expect(useStore.getState().units.find((u) => u.customName === 'Line Troopers')?.groups).toMatchObject([{ count: 5, status: 'wishlisted' }]))

    await user.clear(screen.getByLabelText('Search catalogue'))
    await user.type(screen.getByLabelText('Search catalogue'), 'big walker')
    await user.click(await screen.findByRole('button', { name: 'Add Big Walker' }))
    const ask = screen.getByRole('dialog', { name: 'Big Walker is in your backlog' })
    await user.click(within(ask).getByRole('button', { name: 'My walker (1 models)' }))
    await waitFor(() => expect(useStore.getState().units.find((u) => u.id === 'w1')!.groups.map((g) => [g.count, g.status])).toEqual([[1, 'built'], [1, 'wishlisted']]))
    await user.click(screen.getByRole('button', { name: 'Add Big Walker' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Shopping list only/ }))
    await user.click(screen.getByRole('button', { name: 'Add Big Walker' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'A new backlog entry' }))
    await waitFor(() => expect(useStore.getState().units.filter((u) => u.datasheetId === 'u-walker')).toHaveLength(2))

    await user.clear(screen.getByLabelText('Search catalogue'))
    await user.type(screen.getByLabelText('Search catalogue'), '3b au')
    await user.click(await screen.findByRole('button', { name: 'Add AK Interactive 3B Au/Zb Au' }))
    await waitFor(() => expect(useStore.getState().paintStock.get(PAINT)).toMatchObject({ stage: 'wishlist', quantity: 0 }))

    expect(screen.getByRole('status')).toHaveTextContent('3 to buy')
    await user.click(screen.getByLabelText('Bought Line Troopers'))
    await waitFor(() => expect(useStore.getState().units.find((u) => u.customName === 'Line Troopers')?.groups).toMatchObject([{ count: 5, status: 'sprue' }]))
  })

  it('adds the missing paints of a backlog unit\'s scheme', async () => {
    await appDb.schemes.put({ id: 'sc1', name: 'Sept', description: '', origin: 'personal', stage: 'final', tags: [], tips: '', tutorials: [], createdAt: 't', updatedAt: 't', sections: [{ id: 's', area: 'Armour', steps: [{ id: 'p', technique: 'Basecoat', paints: [{ paintId: PAINT }], notes: '' }] }] } as never)
    await appDb.units.put({ ...createUnit({ customName: 'Crisis', groups: [{ count: 3, status: 'built' }] }, { now: 't', newId: () => 'c1' }), schemeId: 'sc1' })
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Crisis'))
    await user.click(await screen.findByRole('button', { name: 'Add missing paints to shopping list…' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Add to shopping list' })).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(useStore.getState().shopItems.map((x) => [x.name, x.sources])).toEqual([['AK Interactive 3B Au/Zb Au', ['Scheme: Sept']]]))
  })
})
