// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WhoGoesFirst } from './WhoGoesFirst'

const randoms = (...v: number[]) => {
  const q = [...v]
  vi.spyOn(Math, 'random').mockImplementation(() => q.shift() ?? 0)
}
const face = (n: number) => (n - 1) / 6 + 0.01
beforeEach(() => localStorage.setItem('mt.dice3d', 'off'))
afterEach(() => vi.restoreAllMocks())

describe('WhoGoesFirst', () => {
  it('rolls off, ties roll again, the winner picks who goes first', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<WhoGoesFirst mode="roll" opponent="Marco" onDone={onDone} onClose={() => {}} />)
    randoms(face(3), face(3), face(2), face(5))
    await user.click(screen.getByRole('button', { name: 'Roll off' }))
    expect(await screen.findByText('Marco wins')).toBeInTheDocument()
    expect(screen.getByLabelText('Roll-off rounds')).toHaveTextContent('Me 3 – 3 Marco · tie, roll again')
    expect(screen.getByLabelText('Roll-off rounds')).toHaveTextContent('Me 2 – 5 Marco')
    await user.click(screen.getByRole('button', { name: 'I go first' }))
    expect(onDone).toHaveBeenCalledWith('me')
  })

  it('flips a coin against your call', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<WhoGoesFirst mode="coin" opponent="" onDone={onDone} onClose={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'tails' }))
    randoms(0.9)
    await user.click(screen.getByRole('button', { name: 'Flip' }))
    expect(await screen.findByText('You win')).toBeInTheDocument()
    expect(screen.getByText('Tails')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Opponent goes first' }))
    expect(onDone).toHaveBeenCalledWith('them')
  })
})
