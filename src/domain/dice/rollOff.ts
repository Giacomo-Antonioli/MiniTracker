/** Who goes first (#192): roll-off (one D6 each, ties roll again) or a coin flip. */
export type Winner = 'me' | 'them'

/** Winner of one roll-off round, or undefined on a tie. */
export const rollOffWinner = (mine: number, theirs: number): Winner | undefined => (mine > theirs ? 'me' : theirs > mine ? 'them' : undefined)

export type Coin = 'heads' | 'tails'
export const flipCoin = (random: () => number = Math.random): Coin => (random() < 0.5 ? 'heads' : 'tails')
