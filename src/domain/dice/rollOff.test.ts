import { describe, expect, it } from 'vitest'
import { flipCoin, rollOffWinner } from './rollOff'

describe('roll-off and coin', () => {
  it('picks the higher roll, ties roll again', () => {
    expect([rollOffWinner(5, 2), rollOffWinner(1, 6), rollOffWinner(3, 3)]).toEqual(['me', 'them', undefined])
  })
  it('flips a coin', () => {
    expect([flipCoin(() => 0.1), flipCoin(() => 0.9)]).toEqual(['heads', 'tails'])
  })
})
