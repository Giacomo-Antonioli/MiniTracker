// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../app/App'
import { appDb, useStore } from '../../app/store'
import { DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import { DEFAULT_PIPELINES } from '../../domain/pipelines'

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
})
