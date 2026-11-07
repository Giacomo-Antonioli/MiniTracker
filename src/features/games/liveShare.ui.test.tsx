// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { newGame } from '../../domain/games/games'
import { startLive, stopLive } from '../../data/liveSession'
import { JoinLive, LiveStatus } from './LiveShare'

const game = newGame({}, { now: '2026-11-07T10:00:00.000Z', newId: () => 'g1' })
afterEach(() => stopLive())

describe('live game buttons', () => {
  it('Join asks for a proper code', async () => {
    const user = userEvent.setup()
    render(<JoinLive onClose={() => {}} onJoined={() => {}} />)
    await user.type(screen.getByLabelText(/Code shown/), 'nope')
    await user.click(screen.getByRole('button', { name: 'Join' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('not a pairing code')
  })

  it('shows nothing until the game is shared, then the live state', async () => {
    const { rerender } = render(<LiveStatus game={game} />)
    expect(screen.queryByRole('status')).toBeNull()
    startLive({ deviceId: 'A', game, onGame: () => {} })
    rerender(<LiveStatus game={game} />)
    expect(await screen.findByRole('status', { name: 'Live sync' })).toHaveTextContent('connecting…')
  })
})
