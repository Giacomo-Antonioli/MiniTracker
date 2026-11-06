// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DiceRoller } from './DiceRoller'

// Quick mode (no 3D in jsdom); each Math.random() call gives the next die face.
const faces = (...v: number[]) => {
  const q = [...v]
  vi.spyOn(Math, 'random').mockImplementation(() => ((q.shift() ?? 1) - 1) / 6 + 0.01)
}
beforeEach(() => localStorage.setItem('mt.dice3d', 'off'))
afterEach(() => vi.restoreAllMocks())

describe('DiceRoller', () => {
  it('rolls hits, re-rolls 1s, then wounds and saves', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<DiceRoller onClose={onClose} />)
    const dice = screen.getByLabelText('Number of dice')
    await user.clear(dice)
    await user.type(dice, '4')
    faces(1, 2, 3, 6)
    await user.click(screen.getByRole('button', { name: 'Roll 4D6' }))
    expect(await screen.findByText('2 hits of 4')).toBeInTheDocument()
    faces(5)
    await user.click(screen.getByRole('button', { name: 'Re-roll 1s' }))
    expect(await screen.findByText('3 hits of 4')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Wound roll with 3 ▶' }))
    await user.clear(screen.getByLabelText('Strength'))
    await user.type(screen.getByLabelText('Strength'), '8')
    expect(screen.getByLabelText('Target')).toHaveTextContent('2+')
    faces(2, 1, 4)
    await user.click(screen.getByRole('button', { name: 'Roll 3D6' }))
    expect(await screen.findByText('2 wounds of 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Saves for 2 ▶' }))
    await user.clear(screen.getByLabelText('AP'))
    await user.type(screen.getByLabelText('AP'), '-1')
    expect(screen.getByLabelText('Target')).toHaveTextContent('4+')
    faces(4, 3)
    await user.click(screen.getByRole('button', { name: 'Roll 2D6' }))
    expect(await screen.findByText('1 unsaved · 1 saved')).toBeInTheDocument()
    expect(screen.getByLabelText('Attack summary')).toHaveTextContent('3 hits → 2 wounds → 1 unsaved')

    await user.click(screen.getByRole('button', { name: 'Close dice roller' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('says when no save is possible', async () => {
    const user = userEvent.setup()
    render(<DiceRoller onClose={() => {}} />)
    faces(6, 6, 6, 6, 6, 6, 6, 6, 6, 6)
    await user.click(screen.getByRole('button', { name: 'Roll 10D6' }))
    await user.click(await screen.findByRole('button', { name: 'Wound roll with 10 ▶' }))
    faces(6, 6, 6, 6, 6, 6, 6, 6, 6, 6)
    await user.click(screen.getByRole('button', { name: 'Roll 10D6' }))
    await user.click(await screen.findByRole('button', { name: 'Saves for 10 ▶' }))
    await user.clear(screen.getByLabelText('AP'))
    await user.type(screen.getByLabelText('AP'), '-4')
    expect(screen.getByText('No save possible: all 10 wounds get through.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Roll 10D6' })).toBeDisabled()
  })
})
