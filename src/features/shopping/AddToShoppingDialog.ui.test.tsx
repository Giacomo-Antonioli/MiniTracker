// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useStore } from '../../app/store'
import { AddToShoppingDialog } from './AddToShoppingDialog'

describe('AddToShoppingDialog', () => {
  it('lets you leave out models or paints when both are offered', async () => {
    const addToShopping = vi.fn().mockResolvedValue(undefined)
    useStore.setState({ shopLists: [], addToShopping })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddToShoppingDialog onClose={onClose} items={[{ kind: 'model', name: 'Squad', qty: 5 }, { kind: 'paint', name: 'Red', qty: 1 }, { kind: 'paint', name: 'Blue', qty: 1 }]} />)
    const d = screen.getByRole('dialog', { name: 'Add to shopping list' })
    expect(d).toHaveTextContent('3 items: Squad, Red, Blue')
    await user.click(within(d).getByLabelText('Paints (2)'))
    expect(d).toHaveTextContent('1 item: Squad')
    await user.click(within(d).getByLabelText('Models (1)'))
    expect(within(d).getByRole('button', { name: 'Add' })).toBeDisabled()
    await user.click(within(d).getByLabelText('Paints (2)'))
    await user.click(within(d).getByRole('button', { name: 'Add' }))
    expect(addToShopping).toHaveBeenCalledWith([{ kind: 'paint', name: 'Red', qty: 1 }, { kind: 'paint', name: 'Blue', qty: 1 }], [], '')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows no kind choice for one kind', () => {
    useStore.setState({ shopLists: [] })
    render(<AddToShoppingDialog onClose={() => {}} items={[{ kind: 'paint', name: 'Red', qty: 1 }]} />)
    expect(screen.queryByLabelText(/Paints/)).toBeNull()
  })
})
